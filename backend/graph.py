from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from agents import (
    process_files,
    generate_test_scaffolding,
    execute_tests,
    semantic_test_adequacy_reasoning,
    analyze_report,
    generate_suggestions,
)


# Define the state for our graph
class AgentState(TypedDict):
    """
    Represents the state of our agentic workflow.
    """

    file_path: str
    project_context: Optional[str]
    test_scaffolding: Optional[str]
    execution_results: Optional[str]
    intended_behaviors: Optional[list[str]]
    validated_behaviors: Optional[list[str]]
    semantic_gaps: Optional[list[str]]
    fault_classifications: Optional[list[dict]]  # [{gap, type, hint}] from STAR
    report: Optional[str]
    suggestions: Optional[str]
    iteration: int


def refinement_controller(state: AgentState) -> dict:
    """
    Single controller that manages the entire refinement loop.
    Increments the iteration counter on each visit and routes
    the workflow based on its value.

    Routing (checked via route_from_controller after increment):
      iteration 1 or 2  ->  send to STAR for semantic gap analysis
      iteration 3       ->  skip STAR, proceed to report

    Produces the flow:
      builder -> executor -> controller -> star -> builder
      -> executor -> controller -> star -> builder
      -> executor -> controller -> report -> suggestions -> END
    """
    iteration = state.get("iteration", 0)
    return {"iteration": iteration + 1}


def route_from_controller(state: AgentState) -> str:
    """
    Routing function for the single refinement controller.

    Iteration 1 (first pass): always route to STAR so it can perform
    initial semantic-adequacy analysis and populate semantic_gaps.

    Iterations 2+: route to STAR only if semantic gaps remain (soft exit
    matching 'IF G_new is Empty → BREAK' from §5.2.2 / §5.3.6 / §5.5).

    Hard cap: after 3 iterations, skip STAR and proceed to report.
    """
    iteration = state.get("iteration", 0)
    semantic_gaps = state.get("semantic_gaps") or []

    if iteration >= 3:
        # Hard cap reached — proceed to report regardless
        return "report_analyzer"

    if iteration <= 1:
        # First pass — always run STAR to discover initial gaps
        return "semantic_adequacy_reasoner"

    # Subsequent passes — only re-enter STAR if gaps remain
    if len(semantic_gaps) > 0:
        return "semantic_adequacy_reasoner"

    return "report_analyzer"


# Create a new graph
workflow = StateGraph(AgentState)

# 1. Add nodes for each agent
workflow.add_node("file_processor", process_files)
workflow.add_node("scaffold_generator", generate_test_scaffolding)
workflow.add_node("test_executor", execute_tests)
workflow.add_node("semantic_adequacy_reasoner", semantic_test_adequacy_reasoning)
workflow.add_node("refinement_controller", refinement_controller)
workflow.add_node("report_analyzer", analyze_report)
workflow.add_node("suggestion_generator", generate_suggestions)

# 2. Define the edges
workflow.set_entry_point("file_processor")
workflow.add_edge("file_processor", "scaffold_generator")
workflow.add_edge("scaffold_generator", "test_executor")
workflow.add_edge("test_executor", "refinement_controller")
workflow.add_edge("semantic_adequacy_reasoner", "scaffold_generator")
workflow.add_conditional_edges(
    "refinement_controller",
    route_from_controller,
    {
        "semantic_adequacy_reasoner": "semantic_adequacy_reasoner",
        "report_analyzer": "report_analyzer",
    },
)
workflow.add_edge("report_analyzer", "suggestion_generator")
workflow.add_edge("suggestion_generator", END)

# 3. Compile the graph into a runnable agent
agent_graph = workflow.compile()

print("Agentic workflow graph compiled successfully!")
