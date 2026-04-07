# STAR: Semantic Test Adequacy Reasoning

A testing methodology that reframes test adequacy as a semantic optimization problem — not a coverage metric.

## What is STAR?

STAR (**S**emantic **T**est **A**dequacy **R**easoning) defines test adequacy using a formal criterion:

```
G = I − V
```

where **I** = Intended Behaviours (from source code), **V** = Validated Behaviours (from execution), and **G** = the Semantic Gap to be minimized.

The key insight: **100% line coverage ≠ semantic adequacy**. A test can pass and cover every line while asserting nothing meaningful about business logic.

## Architecture

STAR operates as a specialized reasoning agent (Node R) inside a 7-node cyclic orchestration system built on LangGraph:

```
P → B → X → R → M → (loop back to B, or exit to A → S)
```

| Node | Role |
|------|------|
| P — File Processor | Ingests and sanitizes source code |
| B — Scaffold Builder | Generates / refines the test suite |
| X — Test Executor | Runs tests in an isolated subprocess sandbox |
| R — Semantic Reasoner (STAR) | Computes G = I − V, classifies fault types |
| M — Refinement Controller | Circuit breaker: loops or terminates |
| A — Analytical Reporter | Aggregates metrics |
| S — Advisory Synthesizer | Produces human-readable recommendations |

## Fault Taxonomy

| Type | Name | Description |
|------|------|-------------|
| I | Syntactic Hallucination | Valid Python syntax referencing nonexistent methods/libraries |
| II | Assertive Drift | Test passes but asserts nothing meaningful |
| III | Environmental Timeout | Test exceeds 5s — likely infinite loop or unbounded recursion |

## Stack

- **Orchestration:** LangGraph + LangChain
- **LLM Backend:** Google Gemini 2.5 Pro (via Vertex AI) — 1M token context window
- **Server:** FastAPI (async)
- **Test Execution:** pytest, subprocess sandbox with `shutil.rmtree` cleanup
- **Language:** Python 3.10+

## Empirical Results

- All identified gaps are **Type II (Assertive Drift)** — tests pass but validate nothing meaningful
- Semantic gaps persist even at high line coverage, confirming the central thesis
- Circuit breaker converges at δ = 3 iterations; ~60–70% of gross errors resolved by Loop 1

## Setup

```bash
# Clone the repo
git clone https://github.com/yamn1hc043/STAR-Semantic-test-adequacy-reasoning-in-AI-assisted-software-testing.git
cd backend

# Install dependencies (uses uv)
uv sync

# Run
uv run python main.py
```

Requires a Vertex AI / Google Cloud credential configured in your environment.

## Authors

**VIT Vellore**
JK Aarif Mohammed (23MIC0080) · D Chinmay (23MIC0113) · V Mohammed Saiyaan Anser (23MIC0143)
