//! The `hypothesis` command group: the claim tree beside the experiment tree.
//!
//!   orx hypothesis create <projectId> --title "..." [--parent <hypId>]
//!   orx hypothesis list <projectId>
//!   orx hypothesis status <hypId>
//!   orx hypothesis desc <hypId> [--set | --stdin]
//!   orx hypothesis set <hypId> [--status] [--title] [--description]
//!   orx hypothesis source add <hypId> (--url | --paper-id | --experiment)
//!   orx hypothesis source remove <hypId> <sourceId>
//!   orx hypothesis link <hypId> --experiment <expId>
//!   orx hypothesis unlink <hypId> --experiment <expId>
//!   orx hypothesis delete <hypId>

use crate::error::{anyhow, Result};
use crate::local::hypotheses::{self, CreateHypothesis, HypothesisPatch, InternetSourceInput};
use crate::local::model::HypothesisDocument;
use crate::plane::DescInput;
use crate::store::Store;
use crate::{HypothesisArgs, HypothesisCommand, HypothesisSourceCommand};

pub async fn run(args: HypothesisArgs) -> Result<()> {
    let store = Store::open()?;
    match args.command {
        HypothesisCommand::Create {
            project_id,
            title,
            parent,
            description,
            status,
        } => {
            let title = title.ok_or_else(|| anyhow!("Pass --title."))?;
            let project = crate::local::resolve::resolve_project(&store, &project_id)?;
            let doc = hypotheses::create(
                &store,
                &project,
                CreateHypothesis {
                    title,
                    parent_id: parent,
                    description,
                    status,
                },
            )?;
            print_created(&doc);
            Ok(())
        }
        HypothesisCommand::List { project_id } => {
            crate::local::resolve::resolve_project(&store, &project_id)?;
            print_list(&hypotheses::list_documents(&store, &project_id)?);
            Ok(())
        }
        HypothesisCommand::Status { hyp_id } => {
            print_status(&hypotheses::document(&store, &hyp_id)?);
            Ok(())
        }
        HypothesisCommand::Desc { hyp_id, set, stdin } => {
            match DescInput::resolve(set, stdin).await? {
                DescInput::Set(description) => {
                    hypotheses::set_description(&store, &hyp_id, description)?;
                    println!("\u{2713} Description saved.");
                }
                DescInput::Get => {
                    let doc = hypotheses::document(&store, &hyp_id)?;
                    match doc
                        .hypothesis
                        .description
                        .as_deref()
                        .filter(|text| !text.trim().is_empty())
                    {
                        Some(text) => println!("{text}"),
                        None => eprintln!(
                            "No description set. Add one with `orx hypothesis desc {hyp_id} --set \"…\"` \
                             or pipe a file: `cat notes.md | orx hypothesis desc {hyp_id} --stdin`."
                        ),
                    }
                }
            }
            Ok(())
        }
        HypothesisCommand::Set {
            hyp_id,
            status,
            title,
            description,
        } => {
            if status.is_none() && title.is_none() && description.is_none() {
                return Err(anyhow!(
                    "Pass at least one of --status, --title, or --description."
                ));
            }
            let doc = hypotheses::update(
                &store,
                &hyp_id,
                HypothesisPatch {
                    title,
                    description,
                    status,
                    parent_id: None,
                },
            )?;
            print_status(&doc);
            Ok(())
        }
        HypothesisCommand::Source(source) => match source.command {
            HypothesisSourceCommand::Add {
                hyp_id,
                url,
                paper_id,
                title,
                note,
                experiment,
            } => {
                let doc = if let Some(experiment_id) = experiment {
                    if url.is_some() || paper_id.is_some() {
                        return Err(anyhow!(
                        "Pass either --experiment or an internet source (--url / --paper-id), not both."
                    ));
                    }
                    hypotheses::link_experiment(&store, &hyp_id, &experiment_id, "origin", note)?
                } else {
                    hypotheses::add_internet_source(
                        &store,
                        &hyp_id,
                        InternetSourceInput {
                            title,
                            url,
                            paper_id,
                            note,
                        },
                    )?
                };
                print_status(&doc);
                Ok(())
            }
            HypothesisSourceCommand::Remove { hyp_id, source_id } => {
                let doc = hypotheses::remove_internet_source(&store, &hyp_id, &source_id)?;
                print_status(&doc);
                Ok(())
            }
        },
        HypothesisCommand::Link { hyp_id, experiment } => {
            let doc = hypotheses::link_experiment(&store, &hyp_id, &experiment, "test", None)?;
            print_status(&doc);
            Ok(())
        }
        HypothesisCommand::Unlink { hyp_id, experiment } => {
            let doc = hypotheses::unlink_experiment(&store, &hyp_id, &experiment, "test")?;
            print_status(&doc);
            Ok(())
        }
        HypothesisCommand::Delete { hyp_id } => {
            let hypothesis = hypotheses::delete(&store, &hyp_id)?;
            println!(
                "\u{2713} Deleted hypothesis {} ({}).",
                hypothesis.id,
                hypothesis.display_name()
            );
            Ok(())
        }
    }
}

fn print_created(doc: &HypothesisDocument) {
    let hypothesis = &doc.hypothesis;
    println!("\u{2713} Hypothesis created.");
    println!("  id      {}", hypothesis.id);
    println!("  slug    {}", hypothesis.slug);
    println!("  status  {}", hypothesis.status);
    match hypothesis.parent_hypothesis_id.as_deref() {
        Some(parent) => println!("  parent  {parent}"),
        None => println!("  parent  — [root]"),
    }
}

fn print_list(docs: &[HypothesisDocument]) {
    if docs.is_empty() {
        println!("(none)");
        return;
    }
    for doc in docs {
        let hypothesis = &doc.hypothesis;
        let root = if hypothesis.parent_hypothesis_id.is_none() {
            " [root]"
        } else {
            ""
        };
        let parent = hypothesis.parent_hypothesis_id.as_deref().unwrap_or("—");
        let origin = doc
            .experiments
            .iter()
            .filter(|link| link.role == "origin")
            .count();
        let tests = doc
            .experiments
            .iter()
            .filter(|link| link.role == "test")
            .count();
        println!(
            "  {}  {}{}  status={}  parent={}  sources={}  origin={}  tests={}",
            hypothesis.id,
            hypothesis.display_name(),
            root,
            hypothesis.status,
            parent,
            doc.sources.len(),
            origin,
            tests
        );
    }
}

fn print_status(doc: &HypothesisDocument) {
    let hypothesis = &doc.hypothesis;
    println!("{} ({})", hypothesis.display_name(), hypothesis.slug);
    println!("  id          {}", hypothesis.id);
    println!("  project     {}", hypothesis.project_id);
    println!("  status      {}", hypothesis.status);
    match hypothesis.parent_hypothesis_id.as_deref() {
        Some(parent) => println!("  parent      {parent}"),
        None => println!("  parent      — [root]"),
    }
    match hypothesis
        .description
        .as_deref()
        .filter(|text| !text.trim().is_empty())
    {
        Some(text) => println!("  description {text}"),
        None => println!("  description —"),
    }
    println!("  internet sources");
    if doc.sources.is_empty() {
        println!("    (none)");
    } else {
        for source in &doc.sources {
            let label = source
                .title
                .as_deref()
                .filter(|text| !text.is_empty())
                .or(source.paper_id.as_deref())
                .or(source.url.as_deref())
                .unwrap_or(&source.id);
            let locator = source
                .url
                .as_deref()
                .or(source.paper_id.as_deref())
                .unwrap_or("");
            println!("    {}  {}  {}", source.id, label, locator);
        }
    }
    println!("  originating experiments");
    print_links(doc, "origin");
    println!("  testing experiments");
    print_links(doc, "test");
}

fn print_links(doc: &HypothesisDocument, role: &str) {
    let links: Vec<_> = doc
        .experiments
        .iter()
        .filter(|link| link.role == role)
        .collect();
    if links.is_empty() {
        println!("    (none)");
        return;
    }
    for link in links {
        let name = link
            .experiment_title
            .as_deref()
            .filter(|text| !text.is_empty())
            .unwrap_or(if link.experiment_slug.is_empty() {
                link.experiment_id.as_str()
            } else {
                link.experiment_slug.as_str()
            });
        println!("    {}  {}", link.experiment_id, name);
    }
}
