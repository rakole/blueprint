# Blueprint Bootstrap Questioning Guide

Bootstrap questioning is dream extraction, not contract negotiation.

The goal is to leave the conversation with enough clarity to author a strong
`.blueprint/PROJECT.md`, a believable initial requirement set, and a roadmap
that later Blueprint commands can trust.

## Philosophy

You are a thinking partner, not an interviewer.

- Start open and let the user unload their mental model.
- Follow the thread instead of marching through a checklist.
- Ask questions that sharpen the idea, not questions that merely fill slots.
- Use curiosity to reduce ambiguity, not bureaucracy to create it.

## What Good Bootstrap Context Must Cover

By the end of questioning, you should understand:

- what they want to build
- why it needs to exist
- who it is for
- what "done" looks like
- what feels in-scope for the first milestone
- which constraints or non-goals already matter

If those are still fuzzy, downstream Blueprint artifacts will force later
commands to guess.

## How To Ask

### Start Open

Open with a broad invitation such as:

- "What do you want to build?"
- "Walk me through the thing you have in mind."
- "What problem are you trying to solve with this?"

### Follow Energy

Whatever the user emphasizes is where the next question should go.

- If they sound excited, ask why that part matters.
- If they sound frustrated, ask what they are replacing.
- If they use vague words, ask what those words mean in practice.

### Challenge Vagueness

Do not accept fuzzy answers at face value.

- "Simple" means what?
- "Users" means who?
- "Fast" means which part should feel fast?
- "Done" means what observable outcome?

### Make The Abstract Concrete

Useful prompts:

- "Walk me through using it."
- "What does that actually look like?"
- "Give me an example."
- "What would the first successful version let someone do?"

### Clarify Ambiguity

Useful prompts:

- "When you say X, do you mean A or B?"
- "You mentioned Y. Tell me more about that."
- "Is this replacing an existing workflow or creating a new one?"

## Natural Option Lists

Blueprint runs in host-native environments, so prefer normal conversation.

If concise options would help the user react to a concrete tradeoff, present
them through  `ask_user` dialog when possible. Do not turn
the whole conversation into a rigid multiple-choice form.

Good option lists:

- concrete interpretations
- scope cuts
- milestone priorities
- examples the user can accept, reject, or refine

Bad option lists:

- generic buckets
- leading answers
- long surveys
- options that block the user from explaining freely

## Ask User Dialog Rule

When a concrete choice would benefit from structure, prefer one focused
`ask_user` prompt instead of a plain-text menu.

- Ask one question at a time by default.
- Use `type: "choice"` with 2-4 options, each with a clear label and short
  description.
- Include a placeholder such as `Type your own answer...` so the built-in
  custom-answer path stays open.
- Return to freeform conversation as soon as the user wants to elaborate in
  their own words.

## Freeform Rule

When the user wants to explain in their own words, stop forcing structure.

If they want to elaborate, respond with a plain conversational follow-up and
let them keep talking. Return to short options only after you have processed
their freeform answer and a concrete tradeoff would help.

## Session Rhythm

If bootstrap questioning turns into a long session, keep the stage visible with
`update_topic` tool and maintain a short `write_todos` checklist
for the overall flow.

Do not interrupt a useful freeform answer just to narrate status in prose. Let
the user keep talking, and use the Gemini-native progress helpers to keep the
session organized in the background.

## Background Checklist

Keep these in mind without reciting them:

- What are they building?
- Why now?
- Who benefits first?
- What does the first milestone need to prove?
- What can be deferred or excluded?

## Decision Gate

Once you could author a clear bootstrap brief, summarize your understanding and
ask whether you should create the Blueprint bootstrap artifacts now or keep
exploring.

Show that summary as normal Gemini CLI conversation content before opening any
structured approval prompt. The approval prompt should point back to the visible
project brief and roadmap preview; it should never rely on shell output,
temporary files, or collapsed agent/tool panes for the content being approved.

If the user wants to keep exploring, probe the missing edge or uncertainty
instead of repeating the whole questioning cycle.

## Discovery Boundaries

Keep the questioning loop in service of authored bootstrap quality.

- Gather enough signal to classify the repo as greenfield, scaffold-only, or
  brownfield before the first write.
- Gather enough signal to explain whether the first roadmap is
  greenfield-ready or brownfield-provisional.
- Surface workflow preferences only when they materially affect bootstrap
  quality; do not turn the conversation into a settings form too early.
- Hand off detailed persistence, validation, revision-loop, and routing rules
  to `bootstrap-runtime-contract.md` instead of re-explaining them ad hoc.

## Anti-Patterns

- checklist walking regardless of what the user said
- canned questions that ignore the thread
- shallow acceptance of vague answers
- premature tool or stack debates before the product is clear
- corporate-speak prompts that make the conversation colder than it needs to be
- rushing to write files before the idea is coherent
