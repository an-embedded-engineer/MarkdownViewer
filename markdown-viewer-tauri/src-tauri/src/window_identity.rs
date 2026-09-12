use super::*;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowIdentity {
    pub title: String,
    pub root_path: Option<String>,
}
impl WindowIdentity {
    pub fn for_root(root: Option<&Path>) -> Self {
        let Some(root) = root else {
            return Self {
                title: "No Folder — MarkdownViewer".into(),
                root_path: None,
            };
        };
        let display = path_for_external_use(root);
        let name = display
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or_else(|| display.to_str().unwrap_or("Folder"));
        let parent = display
            .parent()
            .and_then(|v| v.to_str())
            .filter(|v| !v.is_empty());
        let title = match parent {
            Some(parent) => format!("{name} — {parent} — MarkdownViewer"),
            None => format!("{name} — MarkdownViewer"),
        };
        Self {
            title,
            root_path: Some(path_to_string(root)),
        }
    }
}
