// Temporary same-tab handoff from the demo product panel to the real inquiry form.
// Contact details stay out of URLs and browser history.
let pendingQuoteDraft = null;

export function stageQuoteDraft(fields) {
  pendingQuoteDraft = { ...fields };
}

export function consumeQuoteDraft() {
  const draft = pendingQuoteDraft;
  pendingQuoteDraft = null;
  return draft;
}
