use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileTreeNode {
    name: String,
    path: String,
    relative_path: String,
    node_type: FileNodeType,
    children: Vec<FileTreeNode>,
}

#[derive(Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
enum FileNodeType {
    Directory,
    Markdown,
    Image,
}

const SKIPPED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "bin",
    "obj",
    "target",
    ".venv",
    "__pycache__",
];

#[tauri::command]
fn scan_directory(root_path: String) -> Result<FileTreeNode, String> {
    let root = normalize_path(PathBuf::from(root_path))?;
    if !root.is_dir() {
        return Err("Selected path is not a directory.".into());
    }

    build_tree(&root, &root)
}

#[tauri::command]
fn read_text_file(root_path: String, path: String) -> Result<String, String> {
    let root = normalize_path(PathBuf::from(root_path))?;
    let file_path = normalize_path(PathBuf::from(path))?;

    if !file_path.starts_with(&root) {
        return Err("File is outside the selected root directory.".into());
    }

    if !is_markdown_path(&file_path) {
        return Err("Selected file is not a Markdown file.".into());
    }

    fs::read_to_string(&file_path).map_err(|error| format!("Failed to read file: {error}"))
}

fn build_tree(path: &Path, root: &Path) -> Result<FileTreeNode, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("Failed to read metadata: {error}"))?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(str::to_owned)
        .unwrap_or_else(|| path.display().to_string());
    let relative_path = path
        .strip_prefix(root)
        .ok()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string();

    if metadata.is_dir() {
        let mut children = Vec::new();
        let entries =
            fs::read_dir(path).map_err(|error| format!("Failed to read directory: {error}"))?;

        for entry in entries {
            let entry =
                entry.map_err(|error| format!("Failed to read directory entry: {error}"))?;
            let child_path = entry.path();
            let child_name = entry.file_name().to_string_lossy().to_string();

            if child_path.is_dir() {
                if SKIPPED_DIRS.contains(&child_name.as_str()) {
                    continue;
                }
                children.push(build_tree(&child_path, root)?);
            } else if is_markdown_path(&child_path) || is_image_path(&child_path) {
                children.push(build_tree(&child_path, root)?);
            }
        }

        children.sort_by(compare_nodes);

        return Ok(FileTreeNode {
            name,
            path: path_to_string(path),
            relative_path,
            node_type: FileNodeType::Directory,
            children,
        });
    }

    let node_type = if is_markdown_path(path) {
        FileNodeType::Markdown
    } else {
        FileNodeType::Image
    };

    Ok(FileTreeNode {
        name,
        path: path_to_string(path),
        relative_path,
        node_type,
        children: Vec::new(),
    })
}

fn compare_nodes(left: &FileTreeNode, right: &FileTreeNode) -> std::cmp::Ordering {
    node_sort_rank(&left.node_type)
        .cmp(&node_sort_rank(&right.node_type))
        .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
}

fn node_sort_rank(node_type: &FileNodeType) -> u8 {
    match node_type {
        FileNodeType::Directory => 0,
        FileNodeType::Markdown => 1,
        FileNodeType::Image => 2,
    }
}

fn normalize_path(path: PathBuf) -> Result<PathBuf, String> {
    path.canonicalize()
        .map_err(|error| format!("Failed to resolve path: {error}"))
}

fn is_markdown_path(path: &Path) -> bool {
    extension(path).is_some_and(|ext| ext == "md" || ext == "markdown")
}

fn is_image_path(path: &Path) -> bool {
    extension(path).is_some_and(|ext| {
        matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "avif"
        )
    })
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![scan_directory, read_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
