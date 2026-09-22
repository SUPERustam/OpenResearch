//! Hypothesis tree — claims, the internet and experiment sources that created
//! them, and the experiment nodes that test them. A hypothesis has no git
//! branch and no run command.

use std::collections::HashMap;

use crate::error::{anyhow, Result};
use crate::store::{now_ms, Store};

use super::model::{
    is_hypothesis_status, HypothesisDocument, HypothesisExperimentRef, HypothesisSource,
    LocalExperiment, LocalHypothesis, LocalProject,
};
use super::slugify;

pub fn list_documents(store: &Store, project_id: &str) -> Result<Vec<HypothesisDocument>> {
    let hypotheses = store.list_hypotheses_by_project(project_id)?;
    let mut sources: HashMap<String, Vec<HypothesisSource>> = HashMap::new();
    for source in store.list_hypothesis_sources_by_project(project_id)? {
        sources
            .entry(source.hypothesis_id.clone())
            .or_default()
            .push(source);
    }
    let mut experiments: HashMap<String, Vec<HypothesisExperimentRef>> = HashMap::new();
    for link in store.list_hypothesis_links_by_project(project_id)? {
        experiments
            .entry(link.hypothesis_id.clone())
            .or_default()
            .push(link);
    }
    Ok(hypotheses
        .into_iter()
        .map(|hypothesis| {
            let id = hypothesis.id.clone();
            HypothesisDocument {
                sources: sources.remove(&id).unwrap_or_default(),
                experiments: experiments.remove(&id).unwrap_or_default(),
                hypothesis,
            }
        })
        .collect())
}

pub fn document(store: &Store, hypothesis_id: &str) -> Result<HypothesisDocument> {
    let hypothesis = require_hypothesis(store, hypothesis_id)?;
    let docs = list_documents(store, &hypothesis.project_id)?;
    docs.into_iter()
        .find(|doc| doc.hypothesis.id == hypothesis_id)
        .ok_or_else(|| anyhow!("Hypothesis {hypothesis_id} not found."))
}

pub struct CreateHypothesis {
    pub title: String,
    pub parent_id: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

pub fn create(
    store: &Store,
    project: &LocalProject,
    spec: CreateHypothesis,
) -> Result<HypothesisDocument> {
    let title = spec.title.trim().to_string();
    if title.is_empty() {
        return Err(anyhow!("A hypothesis title is required."));
    }
    let status = normalize_status(spec.status.as_deref().unwrap_or("open"))?;
    let parent = match spec.parent_id.as_deref() {
        Some(id) => Some(require_parent(store, project, id)?),
        None => None,
    };
    let slug = unique_slug(store, &project.id, &slugify(&title))?;
    let now = now_ms();
    let hypothesis = LocalHypothesis {
        id: uuid::Uuid::new_v4().to_string(),
        project_id: project.id.clone(),
        parent_hypothesis_id: parent.map(|p| p.id),
        slug,
        title: Some(title),
        description: blank_to_none(spec.description),
        status,
        created_at: now,
        updated_at: now,
        chat_session_id: crate::local::chat::launching_chat_session(),
    };
    store.insert_hypothesis(&hypothesis)?;
    document(store, &hypothesis.id)
}

pub struct HypothesisPatch {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub parent_id: Option<Option<String>>,
}

pub fn update(
    store: &Store,
    hypothesis_id: &str,
    patch: HypothesisPatch,
) -> Result<HypothesisDocument> {
    let mut hypothesis = require_hypothesis(store, hypothesis_id)?;
    if let Some(title) = patch.title {
        let title = title.trim().to_string();
        if title.is_empty() {
            return Err(anyhow!("A hypothesis title cannot be empty."));
        }
        hypothesis.title = Some(title);
    }
    if let Some(description) = patch.description {
        hypothesis.description = blank_to_none(Some(description));
    }
    if let Some(status) = patch.status {
        hypothesis.status = normalize_status(&status)?;
    }
    if let Some(parent_id) = patch.parent_id {
        hypothesis.parent_hypothesis_id = match parent_id {
            Some(id) => {
                let project = store
                    .get_local_project(&hypothesis.project_id)?
                    .ok_or_else(|| anyhow!("Project {} not found.", hypothesis.project_id))?;
                let parent = require_parent(store, &project, &id)?;
                assert_no_cycle(store, &hypothesis.id, &parent.id)?;
                Some(parent.id)
            }
            None => None,
        };
    }
    hypothesis.updated_at = now_ms();
    store.update_hypothesis(&hypothesis)?;
    document(store, hypothesis_id)
}

pub fn set_description(
    store: &Store,
    hypothesis_id: &str,
    description: String,
) -> Result<HypothesisDocument> {
    update(
        store,
        hypothesis_id,
        HypothesisPatch {
            title: None,
            description: Some(description),
            status: None,
            parent_id: None,
        },
    )
}

pub struct InternetSourceInput {
    pub title: Option<String>,
    pub url: Option<String>,
    pub paper_id: Option<String>,
    pub note: Option<String>,
}

pub fn add_internet_source(
    store: &Store,
    hypothesis_id: &str,
    input: InternetSourceInput,
) -> Result<HypothesisDocument> {
    let hypothesis = require_hypothesis(store, hypothesis_id)?;
    let url = blank_to_none(input.url);
    let paper_id = blank_to_none(input.paper_id);
    if url.is_none() && paper_id.is_none() {
        return Err(anyhow!("An internet source needs --url or --paper-id."));
    }
    let source = HypothesisSource {
        id: uuid::Uuid::new_v4().to_string(),
        hypothesis_id: hypothesis.id.clone(),
        title: blank_to_none(input.title),
        url,
        paper_id,
        note: blank_to_none(input.note),
        created_at: now_ms(),
    };
    store.insert_hypothesis_source(&source)?;
    store.touch_hypothesis(&hypothesis.id)?;
    document(store, hypothesis_id)
}

pub fn remove_internet_source(
    store: &Store,
    hypothesis_id: &str,
    source_id: &str,
) -> Result<HypothesisDocument> {
    require_hypothesis(store, hypothesis_id)?;
    let removed = store.delete_hypothesis_source(hypothesis_id, source_id)?;
    if !removed {
        return Err(anyhow!(
            "Internet source {source_id} not found on hypothesis {hypothesis_id}."
        ));
    }
    store.touch_hypothesis(hypothesis_id)?;
    document(store, hypothesis_id)
}

pub fn link_experiment(
    store: &Store,
    hypothesis_id: &str,
    experiment_id: &str,
    role: &str,
    note: Option<String>,
) -> Result<HypothesisDocument> {
    let role = normalize_role(role)?;
    let hypothesis = require_hypothesis(store, hypothesis_id)?;
    let experiment = require_same_project_experiment(store, &hypothesis, experiment_id)?;
    let link = HypothesisExperimentRef {
        id: uuid::Uuid::new_v4().to_string(),
        hypothesis_id: hypothesis.id.clone(),
        experiment_id: experiment.id,
        role,
        note: blank_to_none(note),
        experiment_slug: String::new(),
        experiment_title: None,
        created_at: now_ms(),
    };
    store.insert_hypothesis_link(&link)?;
    store.touch_hypothesis(&hypothesis.id)?;
    document(store, hypothesis_id)
}

pub fn unlink_experiment(
    store: &Store,
    hypothesis_id: &str,
    experiment_id: &str,
    role: &str,
) -> Result<HypothesisDocument> {
    let role = normalize_role(role)?;
    require_hypothesis(store, hypothesis_id)?;
    let removed = store.delete_hypothesis_link(hypothesis_id, experiment_id, &role)?;
    if !removed {
        return Err(anyhow!(
            "Hypothesis {hypothesis_id} has no {role} link to experiment {experiment_id}."
        ));
    }
    store.touch_hypothesis(hypothesis_id)?;
    document(store, hypothesis_id)
}

pub fn delete(store: &Store, hypothesis_id: &str) -> Result<LocalHypothesis> {
    let hypothesis = require_hypothesis(store, hypothesis_id)?;
    if store.hypothesis_has_children(hypothesis_id)? {
        return Err(anyhow!(
            "Hypothesis {hypothesis_id} has child hypotheses. Delete or reparent them first."
        ));
    }
    store.delete_hypothesis(hypothesis_id)?;
    Ok(hypothesis)
}

fn require_hypothesis(store: &Store, id: &str) -> Result<LocalHypothesis> {
    store
        .get_hypothesis(id)?
        .ok_or_else(|| anyhow!("Hypothesis {id} not found."))
}

fn require_parent(
    store: &Store,
    project: &LocalProject,
    parent_id: &str,
) -> Result<LocalHypothesis> {
    let parent = require_hypothesis(store, parent_id)?;
    if parent.project_id != project.id {
        return Err(anyhow!(
            "Parent hypothesis {parent_id} belongs to a different project."
        ));
    }
    Ok(parent)
}

fn assert_no_cycle(store: &Store, hypothesis_id: &str, parent_id: &str) -> Result<()> {
    if hypothesis_id == parent_id {
        return Err(anyhow!("A hypothesis cannot be its own parent."));
    }
    let mut cursor = Some(parent_id.to_string());
    let mut guard = 0;
    while let Some(id) = cursor {
        if id == hypothesis_id {
            return Err(anyhow!("That parent would create a cycle."));
        }
        cursor = store
            .get_hypothesis(&id)?
            .and_then(|row| row.parent_hypothesis_id);
        guard += 1;
        if guard > 10_000 {
            return Err(anyhow!("Hypothesis parent chain is too deep."));
        }
    }
    Ok(())
}

fn require_same_project_experiment(
    store: &Store,
    hypothesis: &LocalHypothesis,
    experiment_id: &str,
) -> Result<LocalExperiment> {
    let experiment = store
        .get_local_experiment(experiment_id)?
        .ok_or_else(|| anyhow!("Experiment {experiment_id} not found in the local store."))?;
    if experiment.project_id != hypothesis.project_id {
        return Err(anyhow!(
            "Experiment {experiment_id} belongs to a different project."
        ));
    }
    Ok(experiment)
}

fn normalize_status(status: &str) -> Result<String> {
    let status = status.trim().to_ascii_lowercase();
    if is_hypothesis_status(&status) {
        Ok(status)
    } else {
        Err(anyhow!(
            "Unknown hypothesis status '{status}'. Use open, testing, supported, refuted, or inconclusive."
        ))
    }
}

fn normalize_role(role: &str) -> Result<String> {
    match role.trim() {
        "origin" => Ok("origin".to_string()),
        "test" => Ok("test".to_string()),
        other => Err(anyhow!(
            "Unknown experiment link role '{other}'. Use origin or test."
        )),
    }
}

fn blank_to_none(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim().to_string();
        (!trimmed.is_empty()).then_some(trimmed)
    })
}

fn unique_slug(store: &Store, project_id: &str, base: &str) -> Result<String> {
    let base = if base.is_empty() { "hypothesis" } else { base };
    let taken: std::collections::HashSet<String> = store
        .list_hypotheses_by_project(project_id)?
        .into_iter()
        .map(|row| row.slug)
        .collect();
    if !taken.contains(base) {
        return Ok(base.to_string());
    }
    let mut n = 2;
    loop {
        let candidate = format!("{base}-{n}");
        if !taken.contains(&candidate) {
            return Ok(candidate);
        }
        n += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::local::model::LocalExperiment;

    fn temp_store() -> Store {
        let dir = std::env::temp_dir().join(format!("orx-hypotheses-{}", uuid::Uuid::new_v4()));
        Store::open_at(dir).unwrap()
    }

    fn project(store: &Store) -> LocalProject {
        let project = LocalProject {
            id: "p1".into(),
            name: "Lab".into(),
            slug: "lab".into(),
            github_owner: String::new(),
            github_repo: String::new(),
            github_sync_enabled: false,
            baseline_branch: "main".into(),
            repo_path: "/tmp/lab".into(),
            run_command: None,
            paper_id: None,
            created_at: 1,
            updated_at: 1,
        };
        store.create_local_project(&project).unwrap();
        project
    }

    fn experiment(store: &Store, id: &str, project_id: &str) -> LocalExperiment {
        let experiment = LocalExperiment {
            id: id.into(),
            project_id: project_id.into(),
            parent_experiment_id: None,
            slug: id.into(),
            branch_name: format!("orx/{id}"),
            title: Some(id.into()),
            description: None,
            run_command: String::new(),
            agent_status: "idle".into(),
            created_at: 1,
            updated_at: 1,
            chat_session_id: None,
        };
        store.create_local_experiment(&experiment).unwrap();
        experiment
    }

    #[test]
    fn hypothesis_tree_keeps_sources_and_experiment_links() {
        let store = temp_store();
        let project = project(&store);
        experiment(&store, "exp-origin", "p1");
        experiment(&store, "exp-test", "p1");

        let root = create(
            &store,
            &project,
            CreateHypothesis {
                title: "Muon helps early training".into(),
                parent_id: None,
                description: Some("Doubling matrix LR improves val BPB.".into()),
                status: None,
            },
        )
        .unwrap();
        assert_eq!(root.hypothesis.status, "open");
        assert!(root.hypothesis.parent_hypothesis_id.is_none());

        let child = create(
            &store,
            &project,
            CreateHypothesis {
                title: "Only the matrix LR matters".into(),
                parent_id: Some(root.hypothesis.id.clone()),
                description: None,
                status: Some("testing".into()),
            },
        )
        .unwrap();
        assert_eq!(
            child.hypothesis.parent_hypothesis_id.as_deref(),
            Some(root.hypothesis.id.as_str())
        );

        add_internet_source(
            &store,
            &root.hypothesis.id,
            InternetSourceInput {
                title: Some("LIMA".into()),
                url: Some("https://arxiv.org/abs/2305.11206".into()),
                paper_id: Some("2305.11206".into()),
                note: None,
            },
        )
        .unwrap();
        link_experiment(&store, &root.hypothesis.id, "exp-origin", "origin", None).unwrap();
        let linked =
            link_experiment(&store, &root.hypothesis.id, "exp-test", "test", None).unwrap();
        assert_eq!(linked.sources.len(), 1);
        assert_eq!(
            linked
                .experiments
                .iter()
                .filter(|link| link.role == "origin")
                .count(),
            1
        );
        assert_eq!(
            linked
                .experiments
                .iter()
                .filter(|link| link.role == "test")
                .count(),
            1
        );

        let err = link_experiment(&store, &root.hypothesis.id, "missing", "test", None)
            .unwrap_err()
            .to_string();
        assert!(err.contains("not found"), "{err}");

        let err = delete(&store, &root.hypothesis.id).unwrap_err().to_string();
        assert!(err.contains("child"), "{err}");
        delete(&store, &child.hypothesis.id).unwrap();
        delete(&store, &root.hypothesis.id).unwrap();
        assert!(list_documents(&store, "p1").unwrap().is_empty());
    }

    #[test]
    fn parent_in_another_project_is_rejected() {
        let store = temp_store();
        let project = project(&store);
        let other = LocalProject {
            id: "p2".into(),
            slug: "other".into(),
            name: "Other".into(),
            ..project.clone()
        };
        store.create_local_project(&other).unwrap();
        let foreign = create(
            &store,
            &other,
            CreateHypothesis {
                title: "Foreign".into(),
                parent_id: None,
                description: None,
                status: None,
            },
        )
        .unwrap();
        let err = create(
            &store,
            &project,
            CreateHypothesis {
                title: "Local".into(),
                parent_id: Some(foreign.hypothesis.id),
                description: None,
                status: None,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains("different project"), "{err}");
    }
}
