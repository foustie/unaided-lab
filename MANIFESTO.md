# Unaided Lab Manifesto & Research Protocol

## Core Thesis

Almost every AI lab evaluates whether **models** can pass human exams (MMLU, MATH, GPQA). Almost nobody runs open, reproducible experiments measuring whether an AI interaction actually makes a **human** pass a closed-book exam later without AI.

When an LLM gives a complete solution on the first turn, user satisfaction goes up while long-term retention drops. Unaided Lab optimizes strictly for **unaided human transfer**.

## The Four Rules of an Unaided Loop

1. **Attempt before feedback:** The student commits to an answer or first step before the model responds.
2. **Diagnostic withholding:** On a mistake, the model identifies the exact missing mental step and asks one targeted question instead of printing the final answer.
3. **Mutated spaced retrieval:** Weak concepts return 24 to 72 hours later with rewritten phrasing and numbers so pattern memorization fails.
4. **Closed-book proof check:** Mastery is only counted when the student solves a fresh problem cold with zero AI assistance.

## Primary Metric: 48-Hour Unaided Transfer (U48)

For any concept `c` a student initially misses:
- Assign the student randomly to a study loop (`direct_answer`, `socratic_withholding`, `mutated_retrieval`, or `peer_duel`).
- 48 hours later, present a mutated, closed-book problem testing `c` with zero hints.
- `U48 = (solved cold at 48h) / (initially missed concepts)`.

All aggregate results, prompts, and evaluation scripts will be published openly in this repository.
