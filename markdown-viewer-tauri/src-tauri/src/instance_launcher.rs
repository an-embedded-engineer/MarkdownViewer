use super::*;
use std::sync::atomic::AtomicBool;

#[derive(Default)]
pub(crate) struct InstanceLauncher {
    launching: AtomicBool,
}
struct LaunchGuard<'a>(&'a AtomicBool);
impl Drop for LaunchGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl InstanceLauncher {
    pub fn launch(&self) -> Result<(), ViewerError> {
        if self
            .launching
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err(ViewerError::new(
                "launch",
                "A new window is already being launched.",
            ));
        }
        let _guard = LaunchGuard(&self.launching);
        let exe = std::env::current_exe().map_err(|e| ViewerError::new("launch", e.to_string()))?;
        #[cfg(target_os = "macos")]
        if let Some(bundle) = Self::bundle_path(&exe)? {
            let output = Self::bundle_command(&bundle)
                .output()
                .map_err(|e| ViewerError::new("launch", e.to_string()))?;
            return if output.status.success() {
                Ok(())
            } else {
                Err(ViewerError::new(
                    "launch",
                    format!(
                        "Failed to launch {}: {}",
                        bundle.display(),
                        String::from_utf8_lossy(&output.stderr)
                    ),
                ))
            };
        }
        let mut command = Command::new(exe);
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW); // debugのconsole subsystemでconsoleを作らない。releaseのGUI subsystemでは無視される。
        let mut child = command
            .spawn()
            .map_err(|e| ViewerError::new("launch", e.to_string()))?;
        thread::spawn(move || {
            if let Err(e) = child.wait() {
                eprintln!("Failed to reap Viewer process: {e}");
            }
        });
        Ok(())
    }
    #[cfg(target_os = "macos")]
    fn bundle_command(bundle: &Path) -> Command {
        let mut command = Command::new("/usr/bin/open");
        command.args(["-n", "-a"]).arg(bundle).stdin(Stdio::null());
        command
    }
    #[cfg(target_os = "macos")]
    fn bundle_path(exe: &Path) -> Result<Option<PathBuf>, ViewerError> {
        let Some(macos) = exe
            .parent()
            .filter(|p| p.file_name().is_some_and(|n| n == "MacOS"))
        else {
            return Ok(None);
        };
        let Some(contents) = macos
            .parent()
            .filter(|p| p.file_name().is_some_and(|n| n == "Contents"))
        else {
            return Ok(None);
        };
        let bundle = contents
            .parent()
            .ok_or_else(|| ViewerError::new("launch", "Invalid application bundle."))?;
        if bundle.extension().is_none_or(|e| e != "app") || !contents.join("Info.plist").is_file() {
            return Err(ViewerError::new(
                "launch",
                format!("Invalid application bundle: {}", bundle.display()),
            ));
        }
        Ok(Some(bundle.to_path_buf()))
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;
    #[test]
    fn bundle_detection_and_argv_do_not_fall_back_or_use_a_shell() {
        let directory = std::env::temp_dir().join(format!("mv-launch-{}", uuid::Uuid::new_v4()));
        let bundle = directory.join("Viewer ; $literal.app");
        let executable = bundle.join("Contents/MacOS/viewer");
        fs::create_dir_all(executable.parent().unwrap()).unwrap();
        assert!(InstanceLauncher::bundle_path(&executable).is_err());
        fs::write(bundle.join("Contents/Info.plist"), "test fixture").unwrap();
        assert_eq!(
            InstanceLauncher::bundle_path(&executable).unwrap(),
            Some(bundle.clone())
        );
        assert_eq!(
            InstanceLauncher::bundle_path(&directory.join("target/debug/viewer")).unwrap(),
            None
        );
        let command = InstanceLauncher::bundle_command(&bundle);
        assert_eq!(command.get_program(), "/usr/bin/open");
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            vec![
                std::ffi::OsStr::new("-n"),
                std::ffi::OsStr::new("-a"),
                bundle.as_os_str()
            ]
        );
        fs::remove_dir_all(directory).unwrap();
    }
}
