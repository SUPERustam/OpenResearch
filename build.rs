fn main() {
    println!("cargo:rerun-if-env-changed=ORX_OFFICIAL_RELEASE_BUILD");
    println!("cargo:rerun-if-env-changed=GITHUB_ACTIONS");
    println!("cargo:rerun-if-env-changed=GITHUB_REPOSITORY");

    let channel = match std::env::var("ORX_OFFICIAL_RELEASE_BUILD") {
        Ok(value)
            if value == "1"
                && std::env::var("GITHUB_ACTIONS").as_deref() == Ok("true")
                && std::env::var("GITHUB_REPOSITORY")
                    .as_deref()
                    .is_ok_and(official_release_repo) =>
        {
            "production"
        }
        Ok(value) if value == "1" => panic!(
            "ORX_OFFICIAL_RELEASE_BUILD=1 is only valid in SUPERustam/OpenResearch or alphaXiv/OpenResearch GitHub Actions"
        ),
        Ok(value) => {
            panic!("ORX_OFFICIAL_RELEASE_BUILD must be unset or exactly `1`, got `{value}`")
        }
        Err(std::env::VarError::NotPresent) => "development",
        Err(std::env::VarError::NotUnicode(_)) => {
            panic!("ORX_OFFICIAL_RELEASE_BUILD must be valid UTF-8")
        }
    };

    println!("cargo:rustc-env=ORX_BUILD_CHANNEL={channel}");
}

/// Repos whose GitHub Actions may stamp a production release build.
/// This fork publishes CoHyp downloads; upstream stays accepted so the same
/// guard still matches an alphaXiv Actions run.
fn official_release_repo(repo: &str) -> bool {
    matches!(repo, "SUPERustam/OpenResearch" | "alphaXiv/OpenResearch")
}
