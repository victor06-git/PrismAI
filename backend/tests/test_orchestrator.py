"""
Pure unit tests for the weighted priority-scoring algorithm — no API keys
needed, these never touch OpenAI/Fal.ai/Cala.
"""

from schemas import TicketDraft
from services.orchestrator import classify_ticket, score_and_sort_tickets, score_priority


def _draft(**overrides) -> TicketDraft:
    base = dict(
        title="Sample ticket",
        description="Does a thing.",
        tag="Backend",
        storyPoints=5,
        complexityScore=5,
        businessImpact=5,
        urgency="Medium",
        dependencies=[],
        acceptanceCriteria=["It works."],
    )
    base.update(overrides)
    return TicketDraft(**base)


class TestScorePriority:
    def test_formula_matches_the_spec_exactly(self):
        # 9*0.45 + 10*0.35 - 2*0.20 = 4.05 + 3.5 - 0.4 = 7.15
        assert score_priority(business_impact=9, urgency="Critical", complexity_score=2) == 7.15

    def test_higher_business_impact_scores_higher(self):
        low = score_priority(business_impact=2, urgency="Medium", complexity_score=5)
        high = score_priority(business_impact=9, urgency="Medium", complexity_score=5)
        assert high > low

    def test_higher_complexity_scores_lower(self):
        simple = score_priority(business_impact=5, urgency="Medium", complexity_score=1)
        complex_ = score_priority(business_impact=5, urgency="Medium", complexity_score=10)
        assert simple > complex_

    def test_out_of_range_inputs_are_clamped_not_rejected(self):
        # A stray LLM value outside 1-10 shouldn't crash scoring.
        assert score_priority(business_impact=99, urgency="Medium", complexity_score=-5) == score_priority(
            business_impact=10, urgency="Medium", complexity_score=1
        )


class TestClassifyTicket:
    def test_high_impact_low_complexity_is_quick_win(self):
        assert classify_ticket(business_impact=9, complexity_score=2) == "Quick Win"

    def test_high_impact_high_complexity_is_strategic_initiative(self):
        assert classify_ticket(business_impact=9, complexity_score=9) == "Strategic Initiative"

    def test_low_impact_high_complexity_is_re_evaluate(self):
        assert classify_ticket(business_impact=2, complexity_score=9) == "Re-evaluate"

    def test_middling_scores_are_balanced(self):
        assert classify_ticket(business_impact=5, complexity_score=5) == "Balanced"


class TestScoreAndSortTickets:
    def test_sorts_highest_priority_score_first(self):
        drafts = [
            _draft(title="Low value", businessImpact=2, urgency="Low", complexityScore=8),
            _draft(title="Quick win", businessImpact=9, urgency="High", complexityScore=1),
            _draft(title="Medium", businessImpact=5, urgency="Medium", complexityScore=5),
        ]
        scored = score_and_sort_tickets(drafts)
        assert [t.title for t in scored] == ["Quick win", "Medium", "Low value"]
        assert scored[0].priorityScore >= scored[1].priorityScore >= scored[2].priorityScore

    def test_assigns_unique_sequential_ids(self):
        drafts = [_draft(title=f"Ticket {i}") for i in range(3)]
        scored = score_and_sort_tickets(drafts, start_index=5)
        assert {t.id for t in scored} == {"TCK-6", "TCK-7", "TCK-8"}

    def test_resolves_title_dependencies_to_real_ids(self):
        drafts = [
            _draft(title="Backend API", dependencies=[]),
            _draft(title="Frontend form", dependencies=["Backend API"]),
        ]
        scored = {t.title: t for t in score_and_sort_tickets(drafts)}
        backend_id = scored["Backend API"].id
        assert scored["Frontend form"].dependencies == [backend_id]

    def test_drops_dangling_and_self_referential_dependencies(self):
        drafts = [_draft(title="Solo ticket", dependencies=["Solo ticket", "Nonexistent ticket"])]
        scored = score_and_sort_tickets(drafts)
        assert scored[0].dependencies == []

    def test_every_ticket_gets_a_badge(self):
        drafts = [_draft(title="A"), _draft(title="B", businessImpact=9, complexityScore=2)]
        scored = score_and_sort_tickets(drafts)
        assert all(t.badge in ("Quick Win", "Strategic Initiative", "Re-evaluate", "Balanced") for t in scored)
