#!/usr/bin/env python3
"""2つの検証専用Tauriプロセスを起動し、AppKit activationを記録する。"""
import argparse
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile
import time


class ActivationProbe:
    def __init__(self, binary: Path, output: Path, strategy: str):
        self.output = output.resolve()
        self.output.mkdir(parents=True, exist_ok=True)
        self.runtime = Path(tempfile.mkdtemp(prefix="mv-activation-"))
        self.bundle = self.runtime / "Activation Spike.app"
        macos = self.bundle / "Contents" / "MacOS"
        macos.mkdir(parents=True)
        shutil.copy2(binary, macos / "activation_spike")
        with (self.bundle / "Contents" / "Info.plist").open("wb") as stream:
            plistlib.dump({
                "CFBundleExecutable": "activation_spike",
                "CFBundleIdentifier": "com.shin.markdown-viewer.activation-spike",
                "CFBundleName": "Activation Spike",
                "CFBundlePackageType": "APPL",
                "CFBundleVersion": "1",
                "NSHighResolutionCapable": True,
            }, stream)
        self.sequences = {"a": 0, "b": 0}
        self.results = []
        self.strategy = strategy

    def state(self, role):
        try:
            return json.loads((self.runtime / f"state-{role}.json").read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def wait(self, predicate, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return
            time.sleep(0.025)
        raise RuntimeError(f"Probe timeout: a={self.state('a')}, b={self.state('b')}")

    def command(self, role, action, **fields):
        self.sequences[role] += 1
        payload = {"sequence": self.sequences[role], "action": action, **fields}
        temp = self.runtime / f"command-{role}.tmp"
        temp.write_text(json.dumps(payload))
        os.replace(temp, self.runtime / f"command-{role}.json")
        if action != "exit":
            self.wait(lambda: self.state(role).get("sequence") == payload["sequence"], 3)
            if self.state(role).get("error"):
                raise RuntimeError(self.state(role)["error"])

    def focused(self, role):
        state = self.state(role)
        return state.get("active") and state.get("key") and state.get("onActiveSpace")

    def launch(self, role):
        subprocess.run(["/usr/bin/open", "-n", "-a", str(self.bundle), "--args", role, str(self.runtime)], check=True)
        self.wait(lambda: self.focused(role))

    def activate(self, source, target, scenario):
        before = {"source": self.state(source), "target": self.state(target)}
        started = time.monotonic()
        self.command(source, self.strategy, pid=self.state(target)["pid"])
        self.command(target, "activate")
        try:
            self.wait(lambda: self.focused(target), max(0.01, 2 - (time.monotonic() - started)))
            passed = True
            error = None
        except RuntimeError as exc:
            passed = False
            error = str(exc)
        result = {
            "scenario": scenario, "passed": passed,
            "elapsedMs": round((time.monotonic() - started) * 1000),
            "before": before, "after": {"source": self.state(source), "target": self.state(target)},
            "error": error,
        }
        self.results.append(result)
        print(json.dumps(result), flush=True)
        if not passed:
            raise RuntimeError(f"Activation failed: {scenario}")

    def run(self):
        failure = None
        try:
            self.launch("a")
            self.launch("b")
            assert self.state("a")["pid"] != self.state("b")["pid"]
            self.activate("b", "a", "prepare-requester")
            self.activate("a", "b", "normal")
            self.activate("b", "a", "prepare-minimized")
            self.command("b", "minimize")
            self.wait(lambda: self.state("b").get("minimized"))
            self.activate("a", "b", "minimized")
            self.command("b", "fullscreen")
            self.wait(lambda: self.state("b").get("fullscreen") and self.focused("b"))
            # Space切替アニメーションが完了してからhandoffを試す。
            time.sleep(1.5)
            self.activate("b", "a", "prepare-other-space")
            self.wait(lambda: self.state("b").get("fullscreen") and not self.state("b").get("onActiveSpace"))
            self.activate("a", "b", "fullscreen-other-space")
        except Exception as exc:
            failure = str(exc)
            print(f"Probe failed: {failure}", flush=True)
        finally:
            report = {
                "runtime": str(self.runtime), "bundle": str(self.bundle),
                "strategy": self.strategy,
                "macos": subprocess.check_output(["sw_vers", "-productVersion"], text=True).strip(),
                "results": self.results, "failure": failure,
                "finalStates": {role: self.state(role) for role in ("a", "b")},
            }
            (self.output / "activation-results.json").write_text(json.dumps(report, indent=2) + "\n")
            for role in ("a", "b"):
                self.command(role, "exit")
        return 1 if failure else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--strategy", choices=["yield", "yield-explicit"], default="yield")
    arguments = parser.parse_args()
    raise SystemExit(ActivationProbe(arguments.binary.resolve(), arguments.output, arguments.strategy).run())
