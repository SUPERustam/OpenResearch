//! Wire-friendly local-mode entities — the same camelCase shapes the `orx up`
//! HTTP API serves. Row conversions live here beside the structs; the SQL
//! (matching column order) lives in `store.rs`.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProject {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub github_owner: String,
    pub github_repo: String,
    pub github_sync_enabled: bool,
    /// Fork point for baseline roots and the clone's default checkout — not
    /// where any experiment lives (legacy roots predating per-baseline
    /// branches may still ride it).
    pub baseline_branch: String,
    /// Local repository path.
    pub repo_path: String,
    pub run_command: Option<String>,
    /// arXiv id the project starts from (versionless, e.g. `2401.12345`).
    pub paper_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl LocalProject {
    pub fn github_enabled(&self) -> bool {
        self.github_sync_enabled && self.has_github_repository()
    }

    pub fn has_github_repository(&self) -> bool {
        !self.github_owner.trim().is_empty() && !self.github_repo.trim().is_empty()
    }

    pub fn github_url(&self) -> Option<String> {
        self.has_github_repository().then(|| {
            format!(
                "https://github.com/{}/{}",
                self.github_owner, self.github_repo
            )
        })
    }

    /// Column order must match `store::PROJECT_COLS`.
    pub(crate) fn from_row(row: &rusqlite::Row<'_>) -> std::result::Result<Self, rusqlite::Error> {
        Ok(Self {
            id: row.get(0)?,
            name: row.get(1)?,
            slug: row.get(2)?,
            github_owner: row.get(3)?,
            github_repo: row.get(4)?,
            github_sync_enabled: row.get(5)?,
            baseline_branch: row.get(6)?,
            repo_path: row.get(7)?,
            run_command: row.get(8)?,
            paper_id: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalExperiment {
    pub id: String,
    pub project_id: String,
    /// NULL = baseline/root.
    pub parent_experiment_id: Option<String>,
    pub slug: String,
    /// `orx/<slug>` (legacy baselines ride the project's baseline branch).
    pub branch_name: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub run_command: String,
    pub agent_status: String,
    pub created_at: i64,
    pub updated_at: i64,
    /// Chat session that created this experiment. NULL for dashboard-created,
    /// legacy and out-of-session rows. Immutable once stamped.
    pub chat_session_id: Option<String>,
}

impl LocalExperiment {
    /// Column order must match `store::EXPERIMENT_COLS`.
    pub(crate) fn from_row(row: &rusqlite::Row<'_>) -> std::result::Result<Self, rusqlite::Error> {
        Ok(Self {
            id: row.get(0)?,
            project_id: row.get(1)?,
            parent_experiment_id: row.get(2)?,
            slug: row.get(3)?,
            branch_name: row.get(4)?,
            title: row.get(5)?,
            description: row.get(6)?,
            run_command: row.get(7)?,
            agent_status: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            chat_session_id: row.get(11)?,
        })
    }

    /// Display name: title when set, slug otherwise.
    pub fn display_name(&self) -> &str {
        match self.title.as_deref() {
            Some(t) if !t.trim().is_empty() => t,
            _ => &self.slug,
        }
    }
}

/// Agent-set verdict for a hypothesis. Run outcomes stay on linked experiments.
pub const HYPOTHESIS_STATUSES: &[&str] =
    &["open", "testing", "supported", "refuted", "inconclusive"];

pub fn is_hypothesis_status(status: &str) -> bool {
    HYPOTHESIS_STATUSES.contains(&status)
}

/// A claim node on the hypothesis tree. No branch and no run command —
/// those stay on the experiment that tests the claim.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHypothesis {
    pub id: String,
    pub project_id: String,
    pub parent_hypothesis_id: Option<String>,
    pub slug: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub chat_session_id: Option<String>,
}

impl LocalHypothesis {
    pub(crate) fn from_row(row: &rusqlite::Row<'_>) -> std::result::Result<Self, rusqlite::Error> {
        Ok(Self {
            id: row.get(0)?,
            project_id: row.get(1)?,
            parent_hypothesis_id: row.get(2)?,
            slug: row.get(3)?,
            title: row.get(4)?,
            description: row.get(5)?,
            status: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
            chat_session_id: row.get(9)?,
        })
    }

    pub fn display_name(&self) -> &str {
        match self.title.as_deref() {
            Some(t) if !t.trim().is_empty() => t,
            _ => &self.slug,
        }
    }
}

/// An internet source that motivated a hypothesis. At least one of `url` or
/// `paper_id` is set.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HypothesisSource {
    pub id: String,
    pub hypothesis_id: String,
    pub title: Option<String>,
    pub url: Option<String>,
    pub paper_id: Option<String>,
    pub note: Option<String>,
    pub created_at: i64,
}

impl HypothesisSource {
    pub(crate) fn from_row(row: &rusqlite::Row<'_>) -> std::result::Result<Self, rusqlite::Error> {
        Ok(Self {
            id: row.get(0)?,
            hypothesis_id: row.get(1)?,
            title: row.get(2)?,
            url: row.get(3)?,
            paper_id: row.get(4)?,
            note: row.get(5)?,
            created_at: row.get(6)?,
        })
    }
}

/// An experiment that motivated (`origin`) or tests (`test`) a hypothesis.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HypothesisExperimentRef {
    pub id: String,
    pub hypothesis_id: String,
    pub experiment_id: String,
    pub role: String,
    pub note: Option<String>,
    pub experiment_slug: String,
    pub experiment_title: Option<String>,
    pub created_at: i64,
}

impl HypothesisExperimentRef {
    pub(crate) fn from_row(row: &rusqlite::Row<'_>) -> std::result::Result<Self, rusqlite::Error> {
        Ok(Self {
            id: row.get(0)?,
            hypothesis_id: row.get(1)?,
            experiment_id: row.get(2)?,
            role: row.get(3)?,
            note: row.get(4)?,
            experiment_slug: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            experiment_title: row.get(6)?,
            created_at: row.get(7)?,
        })
    }
}

/// Hypothesis plus its sources and experiment links, the shape the API serves.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HypothesisDocument {
    #[serde(flatten)]
    pub hypothesis: LocalHypothesis,
    pub sources: Vec<HypothesisSource>,
    pub experiments: Vec<HypothesisExperimentRef>,
}
