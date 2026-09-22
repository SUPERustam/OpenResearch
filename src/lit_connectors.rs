//! Extra literature connectors behind the same on/off switches as alphaXiv,
//! OpenAlex, and bioRxiv.
//!
//! Lacuna and Keenable are public HTTP APIs. Asta is the Allen Institute MCP
//! server (`search_papers_by_relevance`, `get_paper`, `snippet_search`); tool
//! calls need `ASTA_API_KEY`. SciSpace's research API has no published request
//! schema, so those commands refuse instead of guessing an endpoint.

use std::time::Duration;

use serde_json::{json, Value};

use crate::client::LitHit;
use crate::error::{anyhow, Result};

const UA: &str = "OpenResearch orx (literature)";

/// Shared discovery controls. `kind` is Lacuna-only (`paper`, `direction`,
/// `hypothesis`); other connectors ignore it.
pub struct ConnectorQuery<'a> {
    pub query: &'a str,
    pub limit: u32,
    pub published_after: Option<&'a str>,
    pub published_before: Option<&'a str>,
    pub prioritize: &'a str,
    pub kind: &'a str,
}

pub fn scispace_unavailable() -> crate::error::Error {
    anyhow!(
        "SciSpace is listed in Data sources, but its research API is invite-only and has no published request schema. OpenResearch will not call an undocumented endpoint. Request access at https://tally.so/r/dWG01z and save SCISPACE_API_KEY; search stays unavailable until SciSpace publishes the API."
    )
}

pub async fn discover_lacuna(query: ConnectorQuery<'_>) -> Result<Vec<LitHit>> {
    let base = crate::config::lacuna_api_url();
    let url = lacuna_search_url(&base, &query);
    let res = crate::client::public_http()
        .get(url)
        .header("user-agent", UA)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach Lacuna at {base}: {e}"))?;
    let status = res.status();
    if !status.is_success() {
        return Err(anyhow!(
            "Lacuna search failed ({} {})",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ));
    }
    let body: Value = res.json().await?;
    Ok(lacuna_hits(&body, query.limit))
}

pub async fn read_lacuna(id_or_url: &str) -> Result<String> {
    let base = crate::config::lacuna_api_url();
    let (route, id) = lacuna_context_route(id_or_url);
    let url = format!("{base}/api/v1/context/{route}/{id}?view=compact");
    let res = crate::client::public_http()
        .get(&url)
        .header("user-agent", UA)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach Lacuna at {base}: {e}"))?;
    let status = res.status();
    if status.as_u16() == 404 {
        return Err(anyhow!(
            "No Lacuna record found for {id_or_url:?}. Search with `orx discover lacuna <query>`."
        ));
    }
    if !status.is_success() {
        return Err(anyhow!(
            "Lacuna lookup failed ({} {})",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ));
    }
    let body: Value = res.json().await?;
    Ok(format_lacuna_read(&body))
}

pub async fn discover_keenable(query: ConnectorQuery<'_>) -> Result<Vec<LitHit>> {
    let base = crate::config::keenable_api_url();
    let (path, key) = keenable_auth();
    let url = format!("{base}{path}");
    let mut req = crate::client::public_http()
        .post(&url)
        .header("user-agent", UA)
        .header("content-type", "application/json")
        .timeout(Duration::from_secs(30))
        .json(&keenable_search_body(&query));
    if let Some(key) = &key {
        req = req.header("X-API-Key", key);
    } else {
        req = req.header("X-Keenable-Title", "OpenResearch");
    }
    let res = req
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach Keenable at {base}: {e}"))?;
    let status = res.status();
    if !status.is_success() {
        return Err(anyhow!(
            "Keenable search failed ({} {})",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ));
    }
    let body: Value = res.json().await?;
    Ok(keenable_hits(&body))
}

pub async fn read_keenable(url: &str) -> Result<String> {
    let page = url.trim();
    if !page.starts_with("http://") && !page.starts_with("https://") {
        return Err(anyhow!(
            "Keenable reads a web page URL. Pass the result URL with `orx paper <url> --source keenable`."
        ));
    }
    let base = crate::config::keenable_api_url();
    let (search_path, key) = keenable_auth();
    let path = if search_path.ends_with("/public") {
        "/v1/fetch/public"
    } else {
        "/v1/fetch"
    };
    let endpoint = format!("{base}{path}?url={}", urlencoding::encode(page));
    let mut req = crate::client::public_http()
        .get(&endpoint)
        .header("user-agent", UA)
        .timeout(Duration::from_secs(30));
    if let Some(key) = &key {
        req = req.header("X-API-Key", key);
    } else {
        req = req.header("X-Keenable-Title", "OpenResearch");
    }
    let res = req
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach Keenable at {base}: {e}"))?;
    let status = res.status();
    if !status.is_success() {
        return Err(anyhow!(
            "Keenable fetch failed ({} {})",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ));
    }
    let body: Value = res.json().await?;
    Ok(format_keenable_read(&body, page))
}

pub async fn discover_asta(query: ConnectorQuery<'_>) -> Result<Vec<LitHit>> {
    let key = asta_key()?;
    let mut args = json!({
        "keyword": query.query,
        "limit": query.limit.clamp(1, 50),
        "fields": "title,abstract,year,authors,venue,citationCount,externalIds,url,paperId",
    });
    if let Some(range) = asta_date_range(query.published_after, query.published_before) {
        args["publication_date_range"] = Value::String(range);
    }
    let body = asta_tool_call(&key, "search_papers_by_relevance", args).await?;
    Ok(asta_hits(&body, query.limit))
}

pub async fn read_asta(id: &str, full: bool) -> Result<String> {
    let key = asta_key()?;
    let paper_id = asta_paper_id(id);
    let paper = asta_tool_call(
        &key,
        "get_paper",
        json!({
            "paper_id": paper_id,
            "fields": "title,abstract,year,authors,venue,citationCount,externalIds,url,paperId,tldr",
        }),
    )
    .await?;
    let mut text = format_asta_read(&paper);
    if full {
        let snippets = asta_tool_call(
            &key,
            "snippet_search",
            json!({
                "query": id,
                "limit": 5,
                "paper_ids": [paper_id],
            }),
        )
        .await?;
        let extra = snippet_text(&snippets);
        if !extra.is_empty() {
            text.push_str("\n\n## Snippets\n\n");
            text.push_str(&extra);
        }
    }
    Ok(text)
}

fn asta_key() -> Result<String> {
    crate::config::lit_api_key("ASTA_API_KEY").ok_or_else(|| {
        anyhow!(
            "Asta needs an API key. Add ASTA_API_KEY in Data sources (request one from https://asta.allen.ai/) and turn Asta on."
        )
    })
}

fn keenable_auth() -> (&'static str, Option<String>) {
    match crate::config::lit_api_key("KEENABLE_API_KEY") {
        Some(key) => ("/v1/search", Some(key)),
        None => ("/v1/search/public", None),
    }
}

pub(crate) fn lacuna_search_url(base: &str, query: &ConnectorQuery<'_>) -> String {
    let mut url = format!(
        "{}/api/v1/search?q={}&type={}&limit={}",
        base.trim_end_matches('/'),
        urlencoding::encode(query.query),
        lacuna_type(query.kind),
        query.limit.clamp(1, 50),
    );
    if let Some(date) = query.published_after {
        url.push_str("&date_from=");
        url.push_str(urlencoding::encode(date).as_ref());
    }
    if let Some(date) = query.published_before {
        url.push_str("&date_to=");
        url.push_str(urlencoding::encode(date).as_ref());
    }
    let sort = match query.prioritize {
        "recency" => "year_desc",
        "historical" => "year_asc",
        _ => "relevance",
    };
    url.push_str("&sort=");
    url.push_str(sort);
    url
}

fn lacuna_type(kind: &str) -> &'static str {
    match kind {
        "direction" | "cluster" => "cluster",
        "hypothesis" | "proposal" | "hypotheses" => "hypothesis",
        _ => "paper",
    }
}

pub(crate) fn lacuna_hits(body: &Value, limit: u32) -> Vec<LitHit> {
    let Some(results) = body.get("results").and_then(Value::as_array) else {
        return Vec::new();
    };
    results
        .iter()
        .filter_map(lacuna_hit)
        .take(limit as usize)
        .collect()
}

fn lacuna_hit(item: &Value) -> Option<LitHit> {
    let title = item.get("title").and_then(Value::as_str)?.trim();
    if title.is_empty() {
        return None;
    }
    let id = lacuna_hit_id(item)?;
    let date = item
        .get("published_date")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| item.get("year").and_then(json_year));
    Some(LitHit {
        source: "lacuna".to_string(),
        id,
        title: title.to_string(),
        abstract_: String::new(),
        publication_date: date,
        votes: None,
        citations: item.get("citations").and_then(Value::as_i64),
        snippets: Vec::new(),
    })
}

fn lacuna_hit_id(item: &Value) -> Option<String> {
    let path = item.get("url").and_then(Value::as_str).unwrap_or("");
    if !path.is_empty() {
        return Some(lacuna_absolute(path));
    }
    item.get("artifact_id")
        .or_else(|| item.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn lacuna_absolute(path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else if path.starts_with('/') {
        format!("https://lacuna.tiptreesystems.com{path}")
    } else {
        format!("https://lacuna.tiptreesystems.com/{path}")
    }
}

pub(crate) fn lacuna_context_route(id_or_url: &str) -> (&'static str, String) {
    let trimmed = id_or_url.trim().trim_end_matches('/');
    let lower = trimmed.to_ascii_lowercase();
    let id = trimmed.rsplit('/').next().unwrap_or(trimmed).to_string();
    let route = if lower.contains("/direction/") || id.chars().all(|c| c.is_ascii_digit()) {
        "direction"
    } else if lower.contains("/hypothesis/") {
        "hypothesis"
    } else if lower.contains("/work/") || id.starts_with("wrk_") {
        "work"
    } else {
        "paper"
    };
    (route, id)
}

fn format_lacuna_read(body: &Value) -> String {
    let title = body
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("Lacuna");
    let url = body
        .get("url")
        .and_then(Value::as_str)
        .map(lacuna_absolute)
        .unwrap_or_else(|| "https://lacuna.tiptreesystems.com".to_string());
    let summary = body
        .get("summary_markdown")
        .or_else(|| body.get("markdown"))
        .and_then(Value::as_str)
        .unwrap_or("");
    format!("# {title}\n\nLacuna: {url}\n\n{summary}")
}

pub(crate) fn keenable_search_body(query: &ConnectorQuery<'_>) -> Value {
    let mut body = json!({
        "query": query.query,
        "max_results": query.limit.clamp(1, 50),
    });
    if let Some(date) = query.published_after {
        body["published_after"] = Value::String(date.to_string());
    }
    if let Some(date) = query.published_before {
        body["published_before"] = Value::String(date.to_string());
    }
    body
}

pub(crate) fn keenable_hits(body: &Value) -> Vec<LitHit> {
    let Some(results) = body.get("results").and_then(Value::as_array) else {
        return Vec::new();
    };
    results.iter().filter_map(keenable_hit).collect()
}

fn keenable_hit(item: &Value) -> Option<LitHit> {
    let url = item.get("url").and_then(Value::as_str)?.trim();
    if url.is_empty() {
        return None;
    }
    let title = item
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or(url)
        .trim();
    let snippet = item.get("snippet").and_then(Value::as_str).unwrap_or("");
    let description = item
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or("");
    let abstract_ = if !snippet.is_empty() {
        snippet.to_string()
    } else {
        description.to_string()
    };
    let publication_date = item
        .get("published_at")
        .and_then(Value::as_str)
        .map(|stamp| stamp.chars().take(10).collect());
    Some(LitHit {
        source: "keenable".to_string(),
        id: url.to_string(),
        title: title.to_string(),
        abstract_,
        publication_date,
        votes: None,
        citations: None,
        snippets: Vec::new(),
    })
}

fn format_keenable_read(body: &Value, fallback_url: &str) -> String {
    let title = body
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or(fallback_url);
    let url = body
        .get("url")
        .and_then(Value::as_str)
        .unwrap_or(fallback_url);
    let content = body.get("content").and_then(Value::as_str).unwrap_or("");
    format!("# {title}\n\nKeenable: {url}\n\n{content}")
}

async fn asta_tool_call(key: &str, name: &str, arguments: Value) -> Result<Value> {
    let base = crate::config::asta_mcp_url();
    let payload = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": { "name": name, "arguments": arguments },
    });
    let res = crate::client::public_http()
        .post(&base)
        .header("user-agent", UA)
        .header("content-type", "application/json")
        .header("accept", "application/json, text/event-stream")
        .header("x-api-key", key)
        .timeout(Duration::from_secs(90))
        .json(&payload)
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach Asta at {base}: {e}"))?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(anyhow!(
            "Asta rejected ASTA_API_KEY ({status}). Check the key in Data sources."
        ));
    }
    if !status.is_success() {
        return Err(anyhow!(
            "Asta request failed ({} {})",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ));
    }
    mcp_tool_result(&text)
}

pub(crate) fn mcp_tool_result(body: &str) -> Result<Value> {
    let messages = mcp_json_messages(body);
    let Some(message) = messages
        .into_iter()
        .rev()
        .find(|message| message.get("result").is_some() || message.get("error").is_some())
    else {
        return Err(anyhow!("Asta returned no JSON-RPC result."));
    };
    if let Some(error) = message.get("error") {
        let detail = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("unknown error");
        return Err(anyhow!("Asta error: {detail}"));
    }
    let result = message.get("result").cloned().unwrap_or(Value::Null);
    if result.get("isError").and_then(Value::as_bool) == Some(true) {
        return Err(anyhow!("Asta tool failed: {}", snippet_text(&result)));
    }
    Ok(result)
}

pub(crate) fn mcp_json_messages(body: &str) -> Vec<Value> {
    let trimmed = body.trim();
    if trimmed.starts_with('{') {
        return serde_json::from_str(trimmed).into_iter().collect();
    }
    body.lines()
        .filter_map(|line| {
            let data = line.trim().strip_prefix("data:")?.trim();
            if data.is_empty() || data == "[DONE]" {
                return None;
            }
            serde_json::from_str(data).ok()
        })
        .collect()
}

pub(crate) fn asta_hits(result: &Value, limit: u32) -> Vec<LitHit> {
    tool_papers(result)
        .into_iter()
        .filter_map(|paper| asta_hit(&paper))
        .take(limit as usize)
        .collect()
}

fn asta_hit(paper: &Value) -> Option<LitHit> {
    let title = paper.get("title").and_then(Value::as_str)?.trim();
    if title.is_empty() {
        return None;
    }
    let external = paper.get("externalIds");
    let arxiv = external
        .and_then(|ids| ids.get("ArXiv"))
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty());
    let doi = external
        .and_then(|ids| ids.get("DOI"))
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty());
    let paper_id = paper.get("paperId").and_then(Value::as_str);
    let id = if let Some(arxiv) = arxiv {
        arxiv.to_string()
    } else if let Some(doi) = doi {
        doi.to_string()
    } else {
        format!("s2:{}", paper_id?)
    };
    let abstract_ = paper
        .get("abstract")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    Some(LitHit {
        source: "asta".to_string(),
        id,
        title: title.to_string(),
        abstract_,
        publication_date: paper.get("year").and_then(json_year),
        votes: None,
        citations: paper.get("citationCount").and_then(Value::as_i64),
        snippets: Vec::new(),
    })
}

fn tool_papers(result: &Value) -> Vec<Value> {
    if let Some(structured) = result.get("structuredContent") {
        let papers = papers_from_value(structured);
        if !papers.is_empty() {
            return papers;
        }
    }
    let text = snippet_text(result);
    serde_json::from_str::<Value>(text.trim())
        .ok()
        .map(|value| papers_from_value(&value))
        .unwrap_or_default()
}

fn papers_from_value(value: &Value) -> Vec<Value> {
    if let Some(items) = value.as_array() {
        return items.clone();
    }
    for key in ["data", "papers", "results", "hits"] {
        if let Some(items) = value.get(key).and_then(Value::as_array) {
            return items.clone();
        }
    }
    if value.get("title").is_some() || value.get("paperId").is_some() {
        return vec![value.clone()];
    }
    Vec::new()
}

fn snippet_text(result: &Value) -> String {
    result
        .get("content")
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

fn format_asta_read(result: &Value) -> String {
    let papers = tool_papers(result);
    let Some(paper) = papers.first() else {
        let text = snippet_text(result);
        return if text.is_empty() {
            "Asta returned no paper.".to_string()
        } else {
            text
        };
    };
    let title = paper.get("title").and_then(Value::as_str).unwrap_or("Asta");
    let url = paper.get("url").and_then(Value::as_str).unwrap_or("");
    let abstract_ = paper.get("abstract").and_then(Value::as_str).unwrap_or("");
    let year = paper.get("year").and_then(json_year).unwrap_or_default();
    format!("# {title}\n\nAsta: {url}\n\n{year}\n\n{abstract_}")
}

pub(crate) fn asta_paper_id(raw: &str) -> String {
    let s = raw.trim();
    let lower = s.to_ascii_lowercase();
    if let Some(rest) = lower.strip_prefix("s2:") {
        return s[s.len() - rest.len()..].to_string();
    }
    if lower.starts_with("arxiv:")
        || lower.starts_with("doi:")
        || lower.starts_with("corpusid:")
        || lower.starts_with("pmid:")
    {
        return s.to_string();
    }
    if s.starts_with("10.") {
        return format!("DOI:{s}");
    }
    if looks_like_arxiv(s) {
        return format!("ARXIV:{}", strip_arxiv_version(s));
    }
    s.to_string()
}

fn looks_like_arxiv(id: &str) -> bool {
    let id = strip_arxiv_version(id);
    let mut parts = id.split('.');
    let Some(head) = parts.next() else {
        return false;
    };
    let Some(tail) = parts.next() else {
        return false;
    };
    parts.next().is_none()
        && head.len() >= 4
        && head.chars().all(|c| c.is_ascii_digit())
        && !tail.is_empty()
        && tail.chars().all(|c| c.is_ascii_digit())
}

fn strip_arxiv_version(id: &str) -> &str {
    match id.rsplit_once('v') {
        Some((head, tail)) if !tail.is_empty() && tail.chars().all(|c| c.is_ascii_digit()) => head,
        _ => id,
    }
}

fn asta_date_range(after: Option<&str>, before: Option<&str>) -> Option<String> {
    match (after, before) {
        (Some(after), Some(before)) => Some(format!("{after}:{before}")),
        (Some(after), None) => Some(format!("{after}:")),
        (None, Some(before)) => Some(format!(":{before}")),
        (None, None) => None,
    }
}

fn json_year(value: &Value) -> Option<String> {
    value
        .as_i64()
        .map(|year| year.to_string())
        .or_else(|| value.as_str().map(str::to_string))
        .filter(|year| !year.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn query(kind: &str) -> ConnectorQuery<'_> {
        ConnectorQuery {
            query: "attention",
            limit: 15,
            published_after: Some("2020-01-01"),
            published_before: None,
            prioritize: "recency",
            kind,
        }
    }

    #[test]
    fn lacuna_search_url_uses_live_parameter_names() {
        let url = lacuna_search_url("https://lacuna.tiptreesystems.com/", &query("direction"));
        assert!(url.contains("/api/v1/search?"));
        assert!(url.contains("q=attention"));
        assert!(url.contains("type=cluster"));
        assert!(url.contains("date_from=2020-01-01"));
        assert!(url.contains("sort=year_desc"));
        assert!(url.contains("limit=15"));
    }

    #[test]
    fn lacuna_hits_prefer_absolute_page_urls() {
        let body = json!({
            "results": [{
                "type": "work",
                "id": "wrk_abc",
                "artifact_id": "art_abc",
                "title": "Attention Is All You Need",
                "url": "/work/attention/wrk_abc",
                "year": 2017,
                "published_date": "2017-01-01",
                "citations": 12
            }]
        });
        let hits = lacuna_hits(&body, 15);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].source, "lacuna");
        assert_eq!(
            hits[0].id,
            "https://lacuna.tiptreesystems.com/work/attention/wrk_abc"
        );
        assert_eq!(hits[0].publication_date.as_deref(), Some("2017-01-01"));
        assert_eq!(hits[0].citations, Some(12));
        assert_eq!(
            lacuna_context_route(&hits[0].id),
            ("work", "wrk_abc".to_string())
        );
    }

    #[test]
    fn keenable_body_uses_max_results() {
        let body = keenable_search_body(&query("paper"));
        assert_eq!(body["max_results"], 15);
        assert_eq!(body["published_after"], "2020-01-01");
        assert!(body.get("limit").is_none());
    }

    #[test]
    fn keenable_hits_keep_the_page_url() {
        let body = json!({
            "results": [{
                "title": "Example",
                "url": "https://example.com/paper",
                "snippet": "A snippet",
                "published_at": "2024-05-01T00:00:00Z"
            }]
        });
        let hits = keenable_hits(&body);
        assert_eq!(hits[0].source, "keenable");
        assert_eq!(hits[0].id, "https://example.com/paper");
        assert_eq!(hits[0].abstract_, "A snippet");
        assert_eq!(hits[0].publication_date.as_deref(), Some("2024-05-01"));
    }

    #[test]
    fn asta_sse_result_maps_arxiv_ids_for_later_reading() {
        let body = "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"{\\\"data\\\":[{\\\"paperId\\\":\\\"abc\\\",\\\"title\\\":\\\"Attention\\\",\\\"abstract\\\":\\\"Transformers.\\\",\\\"year\\\":2017,\\\"citationCount\\\":9,\\\"externalIds\\\":{\\\"ArXiv\\\":\\\"1706.03762\\\"}}]}\"}]}}\n\n";
        let result = mcp_tool_result(body).unwrap();
        let hits = asta_hits(&result, 15);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].source, "asta");
        assert_eq!(hits[0].id, "1706.03762");
        assert_eq!(hits[0].citations, Some(9));
        assert_eq!(asta_paper_id("1706.03762v2"), "ARXIV:1706.03762");
        assert_eq!(asta_paper_id("s2:abc"), "abc");
        assert_eq!(
            asta_paper_id("10.1038/nature14539"),
            "DOI:10.1038/nature14539"
        );
    }

    #[test]
    fn scispace_error_does_not_invent_an_endpoint() {
        let message = scispace_unavailable().to_string();
        assert!(message.contains("invite-only"));
        assert!(!message.contains("api.scispace"));
    }
}
