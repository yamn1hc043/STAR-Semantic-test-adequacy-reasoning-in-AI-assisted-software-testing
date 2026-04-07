import os
import sys
import shutil
import subprocess
import json
import uuid
from dotenv import load_dotenv
from google import genai
import re

load_dotenv()

client = genai.Client(
    vertexai=True,
    project=os.getenv("GCP_PROJECT_ID"),
    location=os.getenv("GCP_LOCATION"),
)


# ---------------------------------------------------------------------------
# Structured logger
# ---------------------------------------------------------------------------
_DIVIDER = "─" * 60

def _log(title: str, body: str | None = None, *, level: str = "INFO") -> None:
    """
    Print a compact, structured log block.
    level: INFO | STEP | OK | WARN | ERROR
    """
    icons = {"INFO": "ℹ", "STEP": "▶", "OK": "✔", "WARN": "⚠", "ERROR": "✖"}
    icon = icons.get(level, "•")
    print(f"\n{_DIVIDER}")
    print(f"{icon}  {title}")
    if body:
        # Indent body lines for readability
        for line in body.strip().splitlines():
            print(f"   {line}")
    print(_DIVIDER)

def process_files(state):
    """
    Processes the uploaded file.
    - if it is a .zip file, it unzips and extracts all the content of text-based files.
    - if it is any other file, it reads the content directly.
    """
    file_path: str = state["file_path"]
    project_context = ""

    _log("STAGE 1 | File Processor", f"Input: {file_path}", level="STEP")

    if file_path.endswith(".zip"):
        extract_dir = os.path.join(os.path.dirname(file_path), "extracted_project")
        shutil.unpack_archive(file_path, extract_dir=extract_dir)

        for root, _, files in os.walk(extract_dir):
            for file in files:
                try:
                    full_path = os.path.join(root, file)
                    with open(full_path, "r", encoding="utf-8") as f:
                        project_context += f"--- File: {file} ---\n{f.read()}\n\n"
                except (UnicodeDecodeError, IOError):
                    _log(f"Skipping file: {file}", level="WARN")
    else:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                project_context = f.read()
        except Exception as e:
            project_context = f"Error Reading file {e}"

    preview = project_context[:200].replace("\n", " ")
    _log("File Processor — Done", f"Context size: {len(project_context)} chars\nPreview: {preview}...", level="OK")
    return {"project_context": project_context}


def generate_test_scaffolding(state):
    """
    Uses an LLM to identify programming language, generate test cases and create a run command.
    """
    project_context: str = state["project_context"]
    semantic_gaps = state.get("semantic_gaps")
    fault_classifications = state.get("fault_classifications") or []
    previous_scaffolding = state.get("test_scaffolding")
    iteration = state.get("iteration", 0)

    _log(f"STAGE 2 | Scaffold Builder  [iteration={iteration}]", level="STEP")

    if semantic_gaps:
        # Build a fault-aware refinement hint block
        fault_hints = ""
        if fault_classifications:
            hint_lines = []
            for fc in fault_classifications:
                hint_lines.append(
                    f"  - Gap: {fc.get('gap','')}\n"
                    f"    Type: {fc.get('type','')} | Hint: {fc.get('hint','')}"
                )
            fault_hints = "\n\nFault Classification Hints (use these to write targeted fixes):\n" + "\n".join(hint_lines)

        prompt_text = f"""
You are an expert QA engineer.

This is a refinement iteration guided by semantic test adequacy feedback.

Your task:
- Preserve all existing generated tests
- Add new test cases ONLY to address the following semantic gaps
- Do NOT duplicate or rewrite existing tests
- Use the fault classification hints below to write more targeted, effective tests

Respond in the SAME JSON format as before.

Source Code:
{project_context}

Existing Tests:
{previous_scaffolding}

Semantic Gaps:
{json.dumps(semantic_gaps, indent=2)}{fault_hints}
"""
    else:
        prompt_text = f"""
You are an expert software developer and a QA engineer. Given the following project context, perform the following tasks:
1. Identify the programming language used in the project.
2. Generate a set of unit test cases that cover the main functionalities of the project.
3. Provide a command to run the tests.

You must respond in the following JSON format:
{{
    "language": "The programming language you identified (e.g., 'JavaScript', 'Python', 'Java')",
    "file_setup": {{
        "description": "A brief, one-sentence description of the files being created.",
        "files": {{
            "filename.ext": "content of the source file",
            "test_filename.ext": "content of the test file",
            "helper_file.ext": "content of any necessary helper or config file (e.g., package.json, pom.xml)"
        }}
    }},
    "run_command": "The single shell command required to install dependencies and run the tests (e.g., 'npm install && npm test', 'uv run pytest <test_filename.ext> -v ', 'mvn test')."
}}
Never use pip directly. Always use uv only.
Analyze the content below and provide the required JSON output.

Source Code:
{project_context}
"""

    response = client.models.generate_content(
        model="gemini-2.5-pro", contents=prompt_text
    )

    scaffolding_str = re.sub(r'^```json\s*|^```\s*|```\s*$', '', response.text.strip(), flags=re.MULTILINE).strip()
    _log("Scaffold Builder — Done", f"Scaffolding size: {len(scaffolding_str)} chars", level="OK")
    return {"test_scaffolding": scaffolding_str}


def execute_tests(state):
    """
    Executes the generated test cases based on the scaffolding plan.
    It creates the files and runs the specified command in a subprocess.
    """
    _log("STAGE 3 | Test Executor", level="STEP")
    scaffolding_str = state["test_scaffolding"]

    try:
        scaffolding_str = re.sub(r'^```json\s*|^```\s*|```\s*$', '', scaffolding_str, flags=re.MULTILINE).strip()
        scaffolding = json.loads(scaffolding_str)
        file_setup = scaffolding.get("file_setup", {}).get("files", {})
        run_command = scaffolding.get("run_command")
        # Keep the full command (including any dependency installation)
        # so the isolated execution directory is self-contained.
        if isinstance(run_command, list):
            run_command = " && ".join(run_command)
    except json.JSONDecodeError as e:
        _log("Test Executor — JSON parse failed", str(e), level="ERROR")
        return {
            "execution_results": f"Error: Failed to decode JSON from test generator. Details: {e}\nContent: {scaffolding_str}"
        }

    if not file_setup or not run_command:
        _log("Test Executor — Invalid scaffolding", "'file_setup' or 'run_command' missing", level="ERROR")
        return {
            "execution_results": "Error: Invalid scaffolding received. 'file_setup' or 'run_command' is missing."
        }

    exec_dir = os.path.join(os.path.dirname(__file__), "reports", str(uuid.uuid4()))
    os.makedirs(exec_dir, exist_ok=True)

    try:
        for filename, content in file_setup.items():
            full_path = os.path.join(exec_dir, filename)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

        env = os.environ.copy()
        python_bin_dir = os.path.dirname(sys.executable)
        homebrew_paths = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/root/.cargo/bin"
        env["PATH"] = python_bin_dir + os.pathsep + homebrew_paths + os.pathsep + env.get("PATH", "")

        _log("Test Executor — Running", f"Command: {run_command}\nFiles: {list(file_setup.keys())}")
        result = subprocess.run(
            run_command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=exec_dir,
            env=env,
        )
        execution_results = (
            f"STDOUT:\n{result.stdout}\n\n"
            f"STDERR:\n{result.stderr}\n\n"
            f"Return Code: {result.returncode}"
        )

    except subprocess.TimeoutExpired:
        execution_results = "Execution timed out. Dependency installation or tests may be too slow."
    except Exception as e:
        execution_results = f"An error occurred during test execution: {e}"
    finally:
        shutil.rmtree(exec_dir)

    # Log a compact summary (first 400 chars of results)
    lines = execution_results.splitlines()
    meaningful = [l for l in lines if any(keep in l for keep in ["PASSED", "FAILED", "ERROR", "passed", "failed", "error", "Return Code"])]
    summary = " | ".join(l.strip() for l in meaningful if l.strip())[:2000]
    _log("Test Executor — Done", f"Result preview: {summary}", level="OK")
    return {"execution_results": execution_results}


def semantic_test_adequacy_reasoning(state):
    """
    STAR Agent: Performs Semantic Test Adequacy Reasoning.
    Evaluates whether the generated tests meaningfully validate the program behavior,
    independent of pass/fail status. Also classifies each gap by fault type.
    """
    iteration = state.get("iteration", 0)
    _log(f"STAGE 4 | STAR — Semantic Adequacy Reasoning  [iteration={iteration}]", level="STEP")
    project_context = state["project_context"]
    test_scaffolding = state["test_scaffolding"]
    execution_results = state["execution_results"]

    prompt_text = f"""
You are a software testing research expert.

Your task is to evaluate the *semantic adequacy* of a test suite.
Semantic adequacy refers to whether the tests meaningfully validate the intended behavior of the program,
not merely whether they pass or fail.

Given:
1. The source code
2. The generated test cases
3. The test execution logs

Perform the following:
- Infer key intended behaviors from the source code (these are the ONLY behaviors that matter)
- Identify which of the intended behaviors are explicitly validated by the tests
- Identify semantic gaps in the test suite (missing or weakly tested behaviors)
- For each semantic gap, classify it into one of:
    * Type I  — Syntactic Hallucination: the test references non-existent functions or libraries
    * Type II — Assertive Drift: the test runs but the assertion is wrong or trivial (wrong expected value, missing edge case)
    * Type III — Environmental Timeout: the test hangs due to infinite loop, slow recursion, or missing mock for external dependency
  Also provide a short, actionable hint for the Builder agent on how to fix this specific gap.

CRITICAL CONSTRAINTS:
- validated_behaviors MUST be a strict subset of intended_behaviors.
  Every entry in validated_behaviors must correspond to an entry in intended_behaviors.
  You cannot validate a behavior you did not list as intended.
- semantic_gaps should capture intended behaviors that are NOT adequately validated.
- |validated_behaviors| + |semantic_gaps| should strictly equal |intended_behaviors|
  (some intended behaviors may partially appear in both if weakly tested).

Respond strictly in the following JSON format:
{{
  "intended_behaviors": ["..."],
  "validated_behaviors": ["..."],
  "semantic_gaps": ["..."],
  "fault_classifications": [
    {{
      "gap": "exact gap description (must match an entry in semantic_gaps)",
      "type": "Type I | Type II | Type III",
      "hint": "specific one-sentence instruction for the Builder to fix this gap"
    }}
  ]
}}

Source Code:
{project_context}

Generated Tests:
{test_scaffolding}

Execution Logs:
{execution_results}
"""

    response = client.models.generate_content(
        model="gemini-2.5-pro", contents=prompt_text
    )

    semantic_text = response.text.strip().lstrip("```json").rstrip("```").strip()

    try:
        semantic_json = json.loads(semantic_text)
    except json.JSONDecodeError as e:
        _log("STAR — JSON parse failed", str(e), level="ERROR")
        semantic_json = {
            "intended_behaviors": [],
            "validated_behaviors": [],
            "semantic_gaps": [],
            "fault_classifications": [],
        }

    gaps = semantic_json.get("semantic_gaps", [])
    classifications = semantic_json.get("fault_classifications", [])
    intended = semantic_json.get("intended_behaviors", [])
    validated = semantic_json.get("validated_behaviors", [])
    expected_gaps = len(intended) - len(validated)

    # Compact log summary
    gap_lines = "\n".join(f"  [{fc.get('type','?')}] {fc.get('gap','')} → {fc.get('hint','')}" for fc in classifications) or "  (none)"
    _log(
        "STAR — Done",
        f"Intended behaviors : {len(intended)}\n"
        f"Validated behaviors: {len(validated)}\n"
        f"Semantic gaps      : {len(gaps)} (expected {expected_gaps})\n"
        f"Fault breakdown    :\n{gap_lines}",
        level="OK" if len(gaps) >= expected_gaps - 1 else "WARN",
    )

    return {
        "intended_behaviors": semantic_json.get("intended_behaviors", []),
        "validated_behaviors": semantic_json.get("validated_behaviors", []),
        "semantic_gaps": gaps,
        "fault_classifications": classifications,
    }


def analyze_report(state):
    """
    Analyzes the test execution results and generates a summary report.
    """
    _log("STAGE 5 | Report Analyzer", level="STEP")
    execution_results = state["execution_results"]
    semantic_gaps = state.get("semantic_gaps", [])
    validated_behaviors = state.get("validated_behaviors", [])

    prompt_text = f"""
You are a test analysis expert.

Your task is to produce a concise analytical test report.

Consider:
1. Test execution results (pass/fail/errors)
2. Semantic test adequacy findings, if available

Specifically:
- Summarize test execution outcomes
- Mention which core behaviors are validated (if provided)
- Mention any semantic gaps indicating untested or weakly tested behaviors (if provided)

Produce a markdown report.

Test Execution Logs:
{execution_results}

Validated Behaviors:
{validated_behaviors}

Semantic Gaps:
{semantic_gaps}
"""

    response = client.models.generate_content(
        model="gemini-2.5-pro", contents=prompt_text
    )

    report = response.text
    _log("Report Analyzer — Done", f"Report size: {len(report)} chars", level="OK")
    return {"report": report}


def generate_suggestions(state):
    """
    Provides suggestions for fixing failed tests and improving the code.
    """
    _log("STAGE 6 | Suggestion Generator", level="STEP")
    project_context = state["project_context"]
    report = state["report"]
    execution_results = state["execution_results"]

    if not execution_results or (
        "failed" not in report.lower() and "error" not in report.lower()
    ):
        _log("Suggestion Generator — Skipped", "No failures detected.", level="OK")
        return {
            "suggestions": "All tests seem to have passed successfully or no failures were detected! No suggestions needed."
        }

    prompt_text = f"""
You are a senior software developer and mentor. Based on the source code and the test report, provide actionable suggestions to fix the bugs and improve the code quality. Be encouraging and clear in your recommendations.

Original Code:
{project_context}

Test Report:
{report}

Please provide your suggestions:
"""

    response = client.models.generate_content(
        model="gemini-2.5-pro", contents=prompt_text
    )

    suggestions = response.text
    _log("Suggestion Generator — Done", f"Suggestions size: {len(suggestions)} chars", level="OK")
    return {"suggestions": suggestions}
