#!/usr/bin/env python3
"""Proportional, local governance gate for the BitBurner repository.

This tool never connects to Bitburner, deploys source, restarts a process, or
moves capital.  It validates the control spine, source/pull manifests, current
claims, approval records, promotion states, and selected static safety rules.

Exit codes are action-profile specific:
  0  the requested gate is PASS/WARN (scoped holds may still be reported)
  2  the requested gate is REVIEW_REQUIRED
  3  the requested gate is BLOCK
"""

from __future__ import print_function

import argparse
import ast
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple


STATUS_ORDER = {"PASS": 0, "WARN": 1, "REVIEW_REQUIRED": 2, "BLOCK": 3}
EXIT_CODE = {"PASS": 0, "WARN": 0, "REVIEW_REQUIRED": 2, "BLOCK": 3}
CONTROL_FILES = {
    "directives": "docs/directive-ledger.json",
    "approvals": "docs/approval-records.jsonl",
    "approval_schema": "docs/approval-records.schema.json",
    "manifest": "docs/artifact-manifest.json",
    "claims": "docs/claim-evidence.json",
    "promotion": "docs/promotion-state.json",
}
APPROVAL_REQUIRED_FIELDS = {
    "recordType",
    "schemaVersion",
    "approvalId",
    "status",
    "approvedBy",
    "recordedBy",
    "recordedAt",
    "scope",
    "riskTier",
    "action",
    "limits",
    "stopConditions",
    "rollback",
    "evidencePath",
    "independentDecision",
    "expiresAt",
    "supersedes",
}
DIRECTIVE_REQUIRED_FIELDS = {
    "id",
    "title",
    "classification",
    "status",
    "authority",
    "source",
    "issuedAt",
    "owner",
    "scope",
    "riskTiers",
    "requirement",
    "acceptanceTests",
    "enforcement",
    "blockScope",
    "nextSafeAction",
    "supersedes",
    "expiresAt",
}
KNOWN_CHECK_IDS = {
    "artifact-source-output",
    "baseline-source-set",
    "claim-evidence-schema",
    "codex-overlay-present",
    "dirty-watched-source",
    "forbidden-stock-api",
    "live-evidence-attested",
    "promotion-state",
    "scoped-findings",
    "scoped-git-boundary",
    "share-loop-yield",
    "subsystem-disabled",
    "tier0-unblocked",
    "tier3-approval",
}
CAPITAL_API_RE = re.compile(
    r"\bns\.stock\.(buyStock|sellStock|buyShort|sellShort|placeOrder|cancelOrder)\s*\("
)
LOOP_RE = re.compile(r"\bwhile\s*\(\s*(?:true|1)\s*\)\s*\{")
EXPECTED_STARTUP = {
    "mcp_supervisor.js",
    "hacking/crawler.js",
    "mcp.js",
    "mcp_hud.js",
    "get_stats.js",
}


@dataclass
class Finding:
    status: str
    checkId: str
    scope: str
    summary: str
    failedCondition: str
    correction: str
    parallelWork: str
    expectedEvidence: str
    owner: str
    blockingProfiles: List[str]

    def validate(self) -> None:
        if self.status not in STATUS_ORDER:
            raise ValueError("unknown finding status: %s" % self.status)
        if self.status in {"REVIEW_REQUIRED", "BLOCK"}:
            required = [
                self.scope,
                self.failedCondition,
                self.correction,
                self.parallelWork,
                self.expectedEvidence,
                self.owner,
            ]
            if not all(required):
                raise ValueError("scoped blocker/review finding is incomplete: %s" % self.checkId)


def _max_status(statuses: Iterable[str]) -> str:
    values = list(statuses)
    if not values:
        return "PASS"
    return max(values, key=lambda value: STATUS_ORDER[value])


def select_gate_findings(
    findings: Sequence[Finding], profile: str, subsystem: Optional[str], tier: Optional[int]
) -> List[Finding]:
    if profile == "action" and tier == 0:
        return []
    shared_scopes = {"governance", "source-sync", "claims", "telemetry"}
    return [
        finding
        for finding in findings
        if profile in finding.blockingProfiles
        and (not subsystem or finding.scope == subsystem or finding.scope in shared_scopes)
    ]


def _run_git(root: Path, args: Sequence[str]) -> Tuple[int, str]:
    try:
        proc = subprocess.run(
            ["git"] + list(args),
            cwd=str(root),
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            check=False,
        )
        return proc.returncode, proc.stdout
    except OSError:
        return 127, ""


def extract_python_literal_list(path: Path, variable: str) -> List[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in tree.body:
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            if any(isinstance(target, ast.Name) and target.id == variable for target in targets):
                value = ast.literal_eval(node.value)
                if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                    raise ValueError("%s is not a literal list of strings" % variable)
                return value
    raise ValueError("%s was not found" % variable)


def extract_loop_bodies(text: str) -> List[str]:
    """Return bodies of simple infinite while loops using balanced braces.

    This is deliberately a conservative static scan, not a JavaScript parser.
    It is sufficient for the small Netscript loop style in this repository;
    uncertain results are reported for review rather than treated as proof.
    """

    bodies: List[str] = []
    for match in LOOP_RE.finditer(text):
        start = text.find("{", match.start())
        depth = 0
        quote: Optional[str] = None
        escaped = False
        line_comment = False
        block_comment = False
        i = start
        while i < len(text):
            char = text[i]
            nxt = text[i + 1] if i + 1 < len(text) else ""
            if line_comment:
                if char == "\n":
                    line_comment = False
            elif block_comment:
                if char == "*" and nxt == "/":
                    block_comment = False
                    i += 1
            elif quote:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == quote:
                    quote = None
            elif char == "/" and nxt == "/":
                line_comment = True
                i += 1
            elif char == "/" and nxt == "*":
                block_comment = True
                i += 1
            elif char in {'"', "'", "`"}:
                quote = char
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    bodies.append(text[start + 1 : i])
                    break
            i += 1
    return bodies


def find_forbidden_apis(text: str) -> List[str]:
    return sorted(set(match.group(1) for match in CAPITAL_API_RE.finditer(text)))


def find_unsafe_loops(text: str) -> List[str]:
    problems: List[str] = []
    for index, body in enumerate(extract_loop_bodies(text), start=1):
        has_async_boundary = bool(re.search(r"\bawait\b|\bns\.(?:sleep|asleep)\s*\(", body))
        if not has_async_boundary:
            problems.append("loop %d has no detectable asynchronous boundary" % index)
        if re.search(r"\bns\.share\s*\(", body) and not re.search(r"\bns\.(?:sleep|asleep)\s*\(", body):
            problems.append("loop %d calls ns.share without an explicit bounded cooldown" % index)
    return problems


def validate_claims_document(data: Any, root: Path) -> List[str]:
    errors: List[str] = []
    if not isinstance(data, dict) or data.get("schemaVersion") != 1:
        return ["claim-evidence.json must be an object with schemaVersion 1"]
    claims = data.get("claims")
    if not isinstance(claims, list):
        return ["claims must be a list"]
    seen: Set[str] = set()
    allowed_classifications = {"fact", "requirement", "assumption", "hypothesis", "unknown"}
    allowed_evidence = {"static", "local", "live", "telemetry", "exploratory-observation", "independent"}
    for index, claim in enumerate(claims):
        label = "claim[%d]" % index
        required = {
            "claimId",
            "statement",
            "classification",
            "status",
            "evidenceClass",
            "evidence",
            "proves",
            "doesNotProve",
        }
        if not isinstance(claim, dict):
            errors.append("%s is not an object" % label)
            continue
        missing = sorted(required - set(claim))
        if missing:
            errors.append("%s missing %s" % (label, ", ".join(missing)))
            continue
        claim_id = claim["claimId"]
        if claim_id in seen:
            errors.append("duplicate claimId %s" % claim_id)
        seen.add(claim_id)
        if claim["classification"] not in allowed_classifications:
            errors.append("%s has invalid classification" % claim_id)
        if claim["evidenceClass"] not in allowed_evidence:
            errors.append("%s has invalid evidenceClass" % claim_id)
        if not isinstance(claim["evidence"], list) or not claim["evidence"]:
            errors.append("%s has no evidence record" % claim_id)
            continue
        if claim["status"] == "live-confirmed":
            attested = False
            for evidence in claim["evidence"]:
                if not isinstance(evidence, dict):
                    continue
                path = evidence.get("path")
                version = evidence.get("sourceVersion")
                if (
                    path
                    and (root / path).exists()
                    and version
                    and version not in {"unknown", "git working tree"}
                    and evidence.get("observedAt")
                    and evidence.get("runId")
                ):
                    attested = True
                    break
            if not attested:
                errors.append("%s is live-confirmed without a retained, versioned run artifact" % claim_id)
    return errors


def validate_approval_records(lines: Sequence[str]) -> Tuple[List[Dict[str, Any]], List[str]]:
    records: List[Dict[str, Any]] = []
    errors: List[str] = []
    seen: Set[str] = set()
    for number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            errors.append("approval line %d is invalid JSON: %s" % (number, error))
            continue
        if not isinstance(record, dict):
            errors.append("approval line %d is not an object" % number)
            continue
        if record.get("recordType") == "ledger-init":
            if number != 1 or record.get("schemaVersion") != 1:
                errors.append("ledger-init must be the first schemaVersion 1 record")
            records.append(record)
            continue
        missing = sorted(APPROVAL_REQUIRED_FIELDS - set(record))
        if missing:
            errors.append("approval line %d missing %s" % (number, ", ".join(missing)))
            continue
        approval_id = record.get("approvalId")
        if not re.match(r"^APR-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9-]+$", str(approval_id)):
            errors.append("approval line %d has invalid approvalId" % number)
        if approval_id in seen:
            errors.append("approvalId %s appears more than once; append a superseding record with a new ID" % approval_id)
        seen.add(str(approval_id))
        if record.get("riskTier") != 3:
            errors.append("approval %s must be riskTier 3" % approval_id)
        if record.get("status") not in {"active", "revoked", "expired", "consumed"}:
            errors.append("approval %s has invalid status" % approval_id)
        if record.get("independentDecision") not in {"ADOPT", "KEEP", "REVISE", "REJECT"}:
            errors.append("approval %s has invalid independentDecision" % approval_id)
        for field in ("scope", "stopConditions", "rollback"):
            if not isinstance(record.get(field), list) or not record.get(field):
                errors.append("approval %s requires non-empty %s" % (approval_id, field))
        records.append(record)
    if not records or records[0].get("recordType") != "ledger-init":
        errors.append("approval ledger must begin with a ledger-init record that grants no authority")
    return records, errors


class Auditor:
    def __init__(self, root: Path, profile: str, subsystem: Optional[str], tier: Optional[int]):
        self.root = root.resolve()
        self.profile = profile
        self.subsystem = subsystem
        self.tier = tier
        self.findings: List[Finding] = []
        self.documents: Dict[str, Any] = {}
        self.approvals: List[Dict[str, Any]] = []
        self.tracked_js: Set[str] = set()

    def add(
        self,
        status: str,
        check_id: str,
        scope: str,
        summary: str,
        failed: str,
        correction: str,
        parallel: str,
        evidence: str,
        owner: str,
        blocking_profiles: Sequence[str] = (),
    ) -> None:
        finding = Finding(
            status=status,
            checkId=check_id,
            scope=scope,
            summary=summary,
            failedCondition=failed,
            correction=correction,
            parallelWork=parallel,
            expectedEvidence=evidence,
            owner=owner,
            blockingProfiles=list(blocking_profiles),
        )
        finding.validate()
        self.findings.append(finding)

    def load_controls(self) -> None:
        for name, relpath in CONTROL_FILES.items():
            path = self.root / relpath
            if not path.exists():
                self.add(
                    "BLOCK",
                    "control-file-present",
                    "governance",
                    "%s is missing" % relpath,
                    "The control spine cannot be evaluated without %s." % relpath,
                    "Restore the named control file from the reviewed governance change.",
                    "Tier 0 inspection and document recovery remain safe.",
                    "The file exists and the session audit parses it.",
                    "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"],
                )
                continue
            if name == "approvals":
                lines = path.read_text(encoding="utf-8").splitlines()
                self.approvals, errors = validate_approval_records(lines)
                for error in errors:
                    self.add(
                        "BLOCK",
                        "approval-ledger-valid",
                        "governance",
                        error,
                        "The append-only authority ledger is malformed or ambiguous.",
                        "Append a valid superseding record; do not rewrite prior valid lines.",
                        "Tier 0 work and approval-record repair remain open.",
                        "The approval parser passes and prior committed bytes remain a prefix.",
                        "Codex and Ken",
                        ["session", "heartbeat", "ci", "action", "promotion"],
                    )
                self._check_approval_append_only(path)
                continue
            try:
                self.documents[name] = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                self.add(
                    "BLOCK",
                    "control-json-valid",
                    "governance",
                    "%s cannot be parsed: %s" % (relpath, error),
                    "A machine-enforced control file is invalid JSON.",
                    "Correct only the malformed control file and rerun the fixture tests.",
                    "Other Tier 0 inspection remains safe.",
                    "The JSON parser and full session audit pass.",
                    "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"],
                )

    def _check_approval_append_only(self, path: Path) -> None:
        code, old = _run_git(self.root, ["show", "HEAD:docs/approval-records.jsonl"])
        if code != 0:
            return
        current = path.read_text(encoding="utf-8")
        old_prefix = old if old.endswith("\n") else old + "\n"
        if not (current == old or current.startswith(old_prefix)):
            self.add(
                "BLOCK",
                "approval-ledger-append-only",
                "governance",
                "Previously committed approval-record bytes were changed or removed.",
                "The authority history is no longer append-only.",
                "Restore the committed prefix and append a new superseding/revocation record.",
                "Tier 0 analysis and reconstruction from git remain open.",
                "git show HEAD:docs/approval-records.jsonl is a byte prefix of the working file.",
                "Codex",
                ["session", "heartbeat", "ci", "action", "promotion"],
            )

    def check_directives(self) -> None:
        data = self.documents.get("directives")
        if not isinstance(data, dict):
            return
        if data.get("schemaVersion") != 2 or not isinstance(data.get("directives"), list):
            self.add(
                "BLOCK", "directive-schema", "governance", "Directive ledger schema is not version 2.",
                "The active authority chain cannot be read deterministically.",
                "Restore schemaVersion 2 with a directives array.",
                "Tier 0 document work remains open.",
                "Directive schema validation passes.", "Codex", ["session", "heartbeat", "ci", "action", "promotion"]
            )
            return
        seen: Set[str] = set()
        for index, directive in enumerate(data["directives"]):
            if not isinstance(directive, dict):
                self.add(
                    "BLOCK", "directive-schema", "governance", "Directive %d is not an object." % index,
                    "The directive cannot be enforced.", "Replace it with a complete directive object.",
                    "Unrelated Tier 0 work remains open.", "Directive validation passes.", "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"]
                )
                continue
            missing = sorted(DIRECTIVE_REQUIRED_FIELDS - set(directive))
            directive_id = str(directive.get("id", "directive[%d]" % index))
            if missing:
                self.add(
                    "BLOCK", "directive-schema", "governance", "%s is missing %s." % (directive_id, ", ".join(missing)),
                    "The directive lacks enforceable ownership or acceptance data.", "Fill only the missing directive fields.",
                    "Unrelated Tier 0 work remains open.", "Directive validation passes.", "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"]
                )
                continue
            if directive_id in seen:
                self.add(
                    "BLOCK", "directive-id-unique", "governance", "Duplicate directive ID %s." % directive_id,
                    "Authority resolution is ambiguous.", "Give the later directive a new ID and use supersedes.",
                    "Unrelated Tier 0 work remains open.", "All active directive IDs are unique.", "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"]
                )
            seen.add(directive_id)
            for test in directive.get("acceptanceTests", []):
                check_id = test.get("checkId") if isinstance(test, dict) else None
                if check_id not in KNOWN_CHECK_IDS:
                    self.add(
                        "WARN", "directive-check-implemented", "governance", "%s references unknown check %r." % (directive_id, check_id),
                        "An acceptance test is documented but not mechanically implemented.",
                        "Implement the check or explicitly mark it manual in the directive.",
                        "All existing implemented checks and Tier 0 work continue.",
                        "The check ID is implemented or labeled manual.", "Codex", []
                    )

    def check_overlay_and_docs(self) -> None:
        agents = self.root / "AGENTS.md"
        text = agents.read_text(encoding="utf-8") if agents.exists() else ""
        markers = ["Codex branch overlay", "CLAUDE.md", "Primary mandate", "tools/standing_orders_audit.py"]
        if not all(marker in text for marker in markers):
            self.add(
                "REVIEW_REQUIRED", "codex-overlay-present", "governance",
                "AGENTS.md does not contain the complete approved Codex overlay.",
                "Repository-local authority and the preserved Claude boundary remain ambiguous.",
                "Add the approved precedence, progress, risk-tier, and audit-gate overlay without editing CLAUDE.md.",
                "Tier 0 inspection and control-file work remain open.",
                "All four overlay markers are present and independently reviewed.", "Codex", ["action", "promotion"]
            )
        processes = self.root / "docs/processes.md"
        ptext = processes.read_text(encoding="utf-8") if processes.exists() else ""
        if "Current governance control state" not in ptext:
            self.add(
                "WARN", "docs-control-banner", "documentation",
                "docs/processes.md lacks a current control-state banner.",
                "Deep historical process prose can be mistaken for current permission.",
                "Add a short current-state banner linking the directive ledger and promotion state.",
                "All local work and the established core baseline remain open.",
                "The banner is present and names every current hold.", "Codex", []
            )
        readme = self.root / "README.md"
        rtext = readme.read_text(encoding="utf-8") if readme.exists() else ""
        if "/Users/kth/Documents/BitBurner" in rtext or "File Sync extension" in rtext:
            self.add(
                "WARN", "docs-current", "documentation", "README.md still describes the retired checkout/sync workflow.",
                "A reader can follow obsolete local and telemetry instructions.",
                "Point the README at /Users/Shared/BitBurner and the Remote API control path.",
                "Engineering and local audit work remain open.", "README no longer contains the retired path or primary extension workflow.",
                "Codex", []
            )

    def check_claims(self) -> None:
        data = self.documents.get("claims")
        if data is None:
            return
        for error in validate_claims_document(data, self.root):
            status = "BLOCK" if "live-confirmed" in error else "REVIEW_REQUIRED"
            profiles = ["promotion", "ci"] if status == "BLOCK" else ["promotion"]
            self.add(
                status, "claim-evidence-schema", "claims", error,
                "A current claim is not tied to evidence with explicit limits.",
                "Correct the claim record or downgrade its status; do not manufacture evidence.",
                "Tier 0 analysis and unrelated subsystem work remain open.",
                "The claim validator passes with a retained artifact for each live-confirmed claim.",
                "Codex and independent reviewer", profiles
            )

    def check_manifest(self) -> None:
        manifest = self.documents.get("manifest")
        if not isinstance(manifest, dict):
            return
        remote = self.root / "tools/bb_remote.py"
        try:
            watched = extract_python_literal_list(remote, "WATCHED_FILES")
            pulled = extract_python_literal_list(remote, "PULL_FILES")
        except (OSError, SyntaxError, ValueError) as error:
            self.add(
                "BLOCK", "sync-manifest-parse", "source-sync", "Cannot read bb_remote source/pull lists: %s" % error,
                "The auditor cannot prove source direction or telemetry retrieval coverage.",
                "Restore literal WATCHED_FILES and PULL_FILES lists or update the parser with tests.",
                "Non-sync Tier 0 work remains open.", "Manifest extraction and fixture tests pass.", "Codex",
                ["session", "heartbeat", "ci", "action", "promotion"]
            )
            return
        declared_watched = manifest.get("watchedSources")
        declared_pulled = manifest.get("pulledArtifacts")
        if watched != declared_watched:
            missing = sorted(set(watched) - set(declared_watched or []))
            extra = sorted(set(declared_watched or []) - set(watched))
            self.add(
                "BLOCK", "source-manifest-consistency", "source-sync",
                "Artifact manifest and WATCHED_FILES differ (missing=%s extra=%s)." % (missing, extra),
                "The live source set has no single auditable identity.",
                "Reconcile the two lists in the same disjoint governance/source-sync change.",
                "Tier 0 work outside source promotion remains open.",
                "The lists match exactly and all entries exist.", "Codex", ["ci", "action", "promotion"]
            )
        if pulled != declared_pulled:
            missing = sorted(set(pulled) - set(declared_pulled or []))
            extra = sorted(set(declared_pulled or []) - set(pulled))
            self.add(
                "BLOCK", "pull-manifest-consistency", "telemetry",
                "Artifact manifest and PULL_FILES differ (missing=%s extra=%s)." % (missing, extra),
                "Required evidence may not be retrievable or may flow in the wrong direction.",
                "Reconcile the lists and exercise the pull fixture before another dependent live run.",
                "Local tests and unrelated operation remain open.",
                "The lists match exactly and the telemetry path is pull-only.", "Codex", ["ci", "action", "promotion"]
            )
        explicit = set(manifest.get("explicitPushOnlySources", []))
        prohibited = set(manifest.get("prohibitedFromSync", []))
        overlap = (explicit | prohibited) & set(watched)
        if overlap:
            self.add(
                "BLOCK", "sync-direction", "source-sync", "Non-watched/prohibited sources appear in WATCHED_FILES: %s" % sorted(overlap),
                "A source can bypass its explicit approval boundary.", "Remove it from WATCHED_FILES and verify connector state before use.",
                "Tier 0 work and established unrelated subsystems remain open.", "The overlap is empty.", "Codex",
                ["session", "heartbeat", "ci", "action", "promotion"]
            )
        for relpath in watched + list(explicit):
            if not (self.root / relpath).exists():
                self.add(
                    "BLOCK", "manifest-source-present", "source-sync", "Manifest source %s is missing." % relpath,
                    "A reconnect or explicit push cannot reproduce the reviewed source set.",
                    "Restore the file or remove it from all manifests in a reviewed change.",
                    "Unrelated Tier 0 work remains open.", "Every source manifest entry exists.", "Codex",
                    ["ci", "action", "promotion"]
                )
        ignore = (self.root / ".gitignore").read_text(encoding="utf-8") if (self.root / ".gitignore").exists() else ""
        for relpath in pulled:
            if relpath not in ignore and not relpath.endswith("override.txt"):
                self.add(
                    "WARN", "generated-artifact-ignore", "telemetry", "%s is pulled telemetry but is not explicitly gitignored." % relpath,
                    "Generated live evidence can enter a source commit accidentally.",
                    "Add the exact generated path to .gitignore while retaining its manifest entry.",
                    "Telemetry analysis and unrelated work remain open.", "%s is ignored and remains pull-only." % relpath,
                    "Codex", []
                )

    def check_startup(self) -> None:
        path = self.root / "startup.js"
        if not path.exists():
            return
        text = path.read_text(encoding="utf-8")
        match = re.search(r"const\s+SCRIPTS\s*=\s*(\[[^\]]*\])", text, re.DOTALL)
        try:
            scripts = set(json.loads(match.group(1))) if match else set()
        except json.JSONDecodeError:
            scripts = set()
        if scripts != EXPECTED_STARTUP:
            self.add(
                "BLOCK", "baseline-source-set", "core-mcp", "startup.js launch set is %s." % sorted(scripts),
                "The standing Tier 2 baseline no longer matches the explicitly authorized process set.",
                "Restore the five-file baseline or obtain a scoped directive for the exact addition.",
                "Tier 0 work and currently running healthy core processes remain open.",
                "Static launch-set check matches the approved set, followed by a bounded health check if restarted.",
                "Codex", ["action", "promotion"]
            )

    def _git_status_paths(self) -> Set[str]:
        code, output = _run_git(self.root, ["status", "--porcelain", "--untracked-files=all"])
        if code != 0:
            return set()
        paths: Set[str] = set()
        for line in output.splitlines():
            if len(line) < 4:
                continue
            raw = line[3:]
            if " -> " in raw:
                raw = raw.split(" -> ", 1)[1]
            paths.add(raw.strip())
        return paths

    def _subsystem_map(self) -> Dict[str, str]:
        result: Dict[str, str] = {}
        promotion = self.documents.get("promotion")
        if isinstance(promotion, dict):
            for subsystem in promotion.get("subsystems", []):
                if isinstance(subsystem, dict):
                    for path in subsystem.get("sourceFiles", []):
                        result[path] = subsystem.get("id", "unknown")
        return result

    def check_git_boundaries(self) -> None:
        code, tracked = _run_git(self.root, ["ls-files", "*.js"])
        if code == 0:
            self.tracked_js = set(line.strip() for line in tracked.splitlines() if line.strip())
        dirty = self._git_status_paths()
        manifest = self.documents.get("manifest") or {}
        watched = set(manifest.get("watchedSources", [])) if isinstance(manifest, dict) else set()
        subsystem_map = self._subsystem_map()
        for path in sorted(dirty):
            subsystem = subsystem_map.get(path)
            if not subsystem:
                continue
            live_source = path in watched or path.endswith(".js")
            if not live_source:
                continue
            status = "REVIEW_REQUIRED"
            self.add(
                status, "dirty-live-source", subsystem,
                "%s is dirty in the synced checkout." % path,
                "The exact source that would run cannot be identified by a commit and may already have been auto-pushed if watched.",
                "Move further implementation to a non-synced worktree, then commit/hash-attest and verify the intended live source before execution.",
                "All Tier 0 work and unrelated subsystem operation remain open.",
                "A clean commit or recorded SHA-256 is matched to the game-side source before the action.",
                "Codex", ["action", "promotion"]
            )
        production_dirty = sorted(path for path in dirty if path.endswith((".js", ".py")) and not path.startswith("tools/standing_orders_audit"))
        governance_dirty = sorted(path for path in dirty if path.startswith("docs/") or path.startswith(".github/") or path.startswith("tools/standing_orders"))
        if production_dirty and governance_dirty:
            self.add(
                "WARN", "scoped-git-boundary", "git",
                "The working tree mixes production and governance changes.",
                "A future broad commit/merge could bind unrelated authority and behavior.",
                "Keep analysis moving now; stage and review disjoint path sets before commit, merge, deployment, or promotion.",
                "Tier 0 work remains fully open.",
                "Boundary-time staged diff contains one coherent scope with named evidence.", "Codex", []
            )

    def _all_js_paths(self) -> List[Path]:
        paths: List[Path] = []
        for path in self.root.rglob("*.js"):
            if any(part in {".git", "node_modules"} for part in path.parts):
                continue
            paths.append(path)
        return sorted(paths)

    def _active_approval_for(self, subsystem: str, path: str) -> bool:
        for record in self.approvals:
            if record.get("recordType") != "approval" or record.get("status") != "active":
                continue
            scope = record.get("scope", [])
            if subsystem in scope or path in scope:
                return True
        return False

    def check_source_safety(self) -> None:
        subsystem_map = self._subsystem_map()
        for path in self._all_js_paths():
            relpath = path.relative_to(self.root).as_posix()
            text = path.read_text(encoding="utf-8", errors="replace")
            capital_apis = find_forbidden_apis(text)
            if capital_apis:
                subsystem = subsystem_map.get(relpath, "stock-trader")
                approved = self._active_approval_for(subsystem, relpath)
                promotion_state = self._promotion_by_id().get(subsystem, {}).get("state")
                if not (approved and promotion_state == "approved-production"):
                    profiles = ["action", "promotion"]
                    if relpath in self.tracked_js:
                        profiles.append("ci")
                    self.add(
                        "BLOCK", "forbidden-stock-api", subsystem,
                        "%s contains capital-moving APIs: %s." % (relpath, ", ".join(capital_apis)),
                        "No active scoped approval and approved-production state authorize this source.",
                        "Keep the file unsynced/unexecuted and obtain a separate cleanup or Tier 3 approval decision.",
                        "Read-only stock analysis and all non-stock work remain open.",
                        "An active append-only approval, independent ADOPT decision, limits, rollback, and approved promotion state name this exact file—or the calls are absent.",
                        "Ken and independent reviewer", profiles
                    )
            unsafe = find_unsafe_loops(text)
            for problem in unsafe:
                subsystem = subsystem_map.get(relpath, relpath)
                self.add(
                    "BLOCK", "unsafe-loop", subsystem,
                    "%s: %s." % (relpath, problem),
                    "An always-on loop lacks the explicit bounded yield required by the active safety directive.",
                    "Add a tested bounded cooldown in a non-synced worktree before any execution; do not restart the current source.",
                    "Local tests, docs, and unrelated subsystem operation remain open.",
                    "Static scan passes, focused fixture tests pass, and a bounded canary has an explicit stop condition.",
                    "Codex", ["action", "promotion"]
                )

    def _promotion_by_id(self) -> Dict[str, Dict[str, Any]]:
        data = self.documents.get("promotion")
        if not isinstance(data, dict):
            return {}
        result: Dict[str, Dict[str, Any]] = {}
        for item in data.get("subsystems", []):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            result[item["id"]] = item
            for alias in item.get("aliases", []):
                if isinstance(alias, str) and alias:
                    result[alias] = item
        return result

    def _canonical_subsystem_id(self, subsystem_id: Optional[str]) -> Optional[str]:
        if not subsystem_id:
            return subsystem_id
        subsystem = self._promotion_by_id().get(subsystem_id)
        return subsystem.get("id") if subsystem else subsystem_id

    def check_promotion_state(self) -> None:
        data = self.documents.get("promotion")
        directives = self.documents.get("directives")
        if not isinstance(data, dict) or not isinstance(directives, dict):
            return
        definitions = data.get("stateDefinitions", {})
        known_directives = {item.get("id") for item in directives.get("directives", []) if isinstance(item, dict)}
        seen: Set[str] = set()
        for subsystem in data.get("subsystems", []):
            if not isinstance(subsystem, dict):
                continue
            subsystem_id = subsystem.get("id")
            if not subsystem_id or subsystem_id in seen:
                self.add(
                    "BLOCK", "promotion-state-schema", "governance", "Promotion subsystem IDs are missing or duplicated.",
                    "Live actions cannot fail closed by subsystem.", "Give every subsystem one unique ID.",
                    "Tier 0 work remains open.", "Promotion-state validation passes.", "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"]
                )
                continue
            seen.add(subsystem_id)
            aliases = subsystem.get("aliases", [])
            if not isinstance(aliases, list) or not all(isinstance(alias, str) and alias for alias in aliases):
                self.add(
                    "BLOCK", "promotion-state-schema", subsystem_id, "%s has an invalid aliases list." % subsystem_id,
                    "Declared operator names cannot be resolved safely.", "Use a list of non-empty strings.",
                    "Tier 0 work remains open.", "Every alias is a unique non-empty string.", "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"]
                )
                aliases = []
            for alias in aliases:
                if alias in seen:
                    self.add(
                        "BLOCK", "promotion-state-schema", subsystem_id, "Promotion alias %s collides with another ID or alias." % alias,
                        "An operator name could resolve to the wrong authority state.", "Give the alias one unique target or remove it.",
                        "Tier 0 work remains open.", "Every subsystem ID and alias is globally unique.", "Codex",
                        ["session", "heartbeat", "ci", "action", "promotion"]
                    )
                seen.add(alias)
            state = subsystem.get("state")
            if state not in definitions:
                self.add(
                    "BLOCK", "promotion-state-schema", subsystem_id, "%s uses undefined state %r." % (subsystem_id, state),
                    "The live action cannot be evaluated fail-closed.", "Define the state or select an existing reviewed state.",
                    "Tier 0 work remains open.", "State is defined and tested.", "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"]
                )
            missing_authority = sorted(set(subsystem.get("authority", [])) - known_directives)
            if missing_authority:
                self.add(
                    "BLOCK", "promotion-authority", subsystem_id, "%s references missing directives %s." % (subsystem_id, missing_authority),
                    "The state has no traceable authority.", "Add the directive or correct the reference.",
                    "Tier 0 work remains open.", "Every authority ID resolves to an active directive.", "Codex",
                    ["session", "heartbeat", "ci", "action", "promotion"]
                )
            if state == "approved-production":
                approval_ids = subsystem.get("approvalIds", [])
                active_ids = {
                    record.get("approvalId")
                    for record in self.approvals
                    if record.get("recordType") == "approval" and record.get("status") == "active"
                }
                if not approval_ids or not set(approval_ids).issubset(active_ids):
                    self.add(
                        "BLOCK", "tier3-approval", subsystem_id, "%s is approved-production without matching active approvals." % subsystem_id,
                        "A Tier 3 promotion lacks current human authority.", "Append the narrow approval record or return the subsystem to a denied state.",
                        "Tier 0 and approved unrelated operation remain open.", "Every approvalId resolves to an active record with retained evidence.",
                        "Ken and independent reviewer", ["session", "heartbeat", "ci", "action", "promotion"]
                    )

    def check_r8_evidence_gate(self) -> None:
        source = self.root / "mcp_formulas_shadow.js"
        if source.exists():
            text = source.read_text(encoding="utf-8")
            if "openTail(" not in text:
                self.add(
                    "BLOCK", "r8-visible-tail", "formulas-r8",
                    "mcp_formulas_shadow.js prints snapshots but never opens its tail.",
                    "The promised visual evidence channel is not established automatically.",
                    "Implement and locally test an explicitly sized openTail call in a non-synced worktree.",
                    "Pure calculator tests, report analysis, and core MCP operation remain open.",
                    "Static source contains the approved tail call and a bounded live canary visibly renders the exact persisted record.",
                    "Codex", ["action", "promotion"]
                )
            if 'ns.write(SNAPSHOT_FILE, `${line}\\n`, "a")' not in text or "ns.print(`snapshot: ${line}`)" not in text:
                self.add(
                    "BLOCK", "r8-cumulative-visible-output", "formulas-r8",
                    "The R8 source does not statically prove append-mode output plus the same printed record.",
                    "The evidence contract can regress to overwrite-only or invisible output.",
                    "Restore the one-record/append/print helper and its focused static fixture.",
                    "Other Tier 0 work remains open.", "Static checks and a bounded retrieved run show one line per sample.",
                    "Codex", ["action", "promotion"]
                )
        output = self.root / "mcp_formulas_shadow.txt"
        if not output.exists():
            self.add(
                "BLOCK", "r8-output-retrieved", "formulas-r8",
                "The reported mcp_formulas_shadow.txt run artifact is absent from the local repository checkout.",
                "The completed run cannot be parsed, counted, tied to source, or independently reviewed.",
                "Use the already-configured pull path to retrieve the existing file before running the monitor again.",
                "Tail-source repair, local tests, and all unrelated work remain open.",
                "The local file exists, parses as cumulative JSON lines, has the expected bounded sample count, and is source/run attested.",
                "Codex", ["action", "promotion"]
            )

    def action_gate(self) -> None:
        if self.profile not in {"action", "promotion"}:
            return
        if not self.subsystem:
            self.add(
                "BLOCK", "action-subsystem-required", "governance",
                "An action/promotion gate was requested without --subsystem.",
                "The gate cannot scope its decision and would risk a blanket block.",
                "Rerun with --subsystem and the minimum applicable --tier.",
                "Tier 0 inspection remains open.", "The command names one known subsystem and tier.", "Codex",
                [self.profile]
            )
            return
        subsystem = self._promotion_by_id().get(self.subsystem)
        if not subsystem:
            self.add(
                "BLOCK", "unknown-subsystem", self.subsystem,
                "No promotion-state record exists for %s." % self.subsystem,
                "Unknown live actions fail closed.", "Add and independently review a scoped subsystem record.",
                "Tier 0 work remains open.", "The subsystem has an owner, tier, rollback, evidence, and state.",
                "Codex and independent reviewer", [self.profile]
            )
            return
        requested_tier = self.tier if self.tier is not None else int(subsystem.get("riskTier", 3))
        if requested_tier == 0:
            return
        state = subsystem.get("state")
        allowed = state in {"operational-baseline", "support-active", "approved-production"}
        if self.profile == "promotion":
            allowed = state in {"operational-baseline", "approved-production"}
        if not allowed:
            self.add(
                "BLOCK", "promotion-state", self.subsystem,
                "%s is %s, so Tier %d %s is denied." % (self.subsystem, state, requested_tier, self.profile),
                "The fail-closed state does not authorize this live boundary.",
                "Complete the smallest listed conditionsToAdvance and obtain any required approval; do not broaden the pause.",
                subsystem.get("nextSafeAction", "Tier 0 work remains open."),
                "; ".join(subsystem.get("conditionsToAdvance", [])) or "A reviewed state transition record.",
                subsystem.get("owner", "Codex"), [self.profile]
            )
        canonical_id = subsystem.get("id", self.subsystem)
        if requested_tier == 3 and state == "approved-production":
            if not all(self._active_approval_for(canonical_id, path) for path in subsystem.get("sourceFiles", []) if path.endswith(".js")):
                self.add(
                    "BLOCK", "tier3-approval", self.subsystem,
                    "Tier 3 action lacks an active approval covering every promoted source.",
                    "Human authority is narrower than the requested action.",
                    "Append a scope-correct approval after independent review or narrow the action.",
                    subsystem.get("nextSafeAction", "Tier 0 work remains open."),
                    "Active approval scope, limits, stop conditions, rollback, and evidence cover the exact action.",
                    "Ken and independent reviewer", [self.profile]
                )

    def run(self) -> Dict[str, Any]:
        self.load_controls()
        self.check_directives()
        self.check_overlay_and_docs()
        self.check_claims()
        self.check_manifest()
        self.check_startup()
        self.check_git_boundaries()
        self.check_source_safety()
        self.check_promotion_state()
        self.check_r8_evidence_gate()
        self.action_gate()
        portfolio_status = _max_status(finding.status for finding in self.findings)
        # A held live subsystem does not make reading, local tests, or static
        # analysis unsafe. Keep every finding visible while Tier 0 remains
        # open by construction.
        gate_findings = select_gate_findings(
            self.findings, self.profile, self._canonical_subsystem_id(self.subsystem), self.tier
        )
        gate_status = _max_status(finding.status for finding in gate_findings)
        if gate_status == "WARN":
            gate_status = "PASS"
        return {
            "schemaVersion": 1,
            "profile": self.profile,
            "subsystem": self.subsystem,
            "tier": self.tier,
            "gateStatus": gate_status,
            "portfolioStatus": portfolio_status,
            "findingCounts": {
                status: sum(1 for finding in self.findings if finding.status == status)
                for status in STATUS_ORDER
            },
            "findings": [asdict(finding) for finding in self.findings],
        }


def render_text(report: Dict[str, Any]) -> str:
    lines = [
        "Standing Orders gate: %s (profile=%s%s)"
        % (
            report["gateStatus"],
            report["profile"],
            ", subsystem=%s" % report["subsystem"] if report.get("subsystem") else "",
        ),
        "Portfolio status: %s (scoped holds do not stop unrelated progress)" % report["portfolioStatus"],
    ]
    counts = report["findingCounts"]
    lines.append("Findings: " + ", ".join("%s=%d" % (name, counts[name]) for name in STATUS_ORDER))
    for finding in report["findings"]:
        lines.append("")
        lines.append("[%s] %s / %s — %s" % (finding["status"], finding["scope"], finding["checkId"], finding["summary"]))
        if finding["status"] in {"REVIEW_REQUIRED", "BLOCK"}:
            lines.append("  condition: %s" % finding["failedCondition"])
            lines.append("  correction: %s" % finding["correction"])
            lines.append("  parallel: %s" % finding["parallelWork"])
            lines.append("  clears with: %s" % finding["expectedEvidence"])
            lines.append("  owner: %s" % finding["owner"])
    if not report["findings"]:
        lines.append("No findings.")
    return "\n".join(lines)


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--profile", choices=["session", "heartbeat", "ci", "action", "promotion"], default="session")
    parser.add_argument("--subsystem")
    parser.add_argument("--tier", type=int, choices=[0, 1, 2, 3])
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument("--report", type=Path, help="Write the complete JSON result to a local heartbeat/report path.")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    report = Auditor(args.root, args.profile, args.subsystem, args.tier).run()
    output = json.dumps(report, indent=2, sort_keys=True) if args.as_json else render_text(report)
    print(output)
    if args.report:
        report_path = args.report if args.report.is_absolute() else args.root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return EXIT_CODE[report["gateStatus"]]


if __name__ == "__main__":
    sys.exit(main())
