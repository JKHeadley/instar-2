// A failed status probe is before worker launch or input dispatch. Keep the
// existing input queued so the owner tick can retry the same admission.
export async function admitSessionOrQueue(admit) {
  try { await admit(); return true; }
  catch (error) {
    if (error instanceof Error && error.message === 'subscription authentication status unavailable') return false;
    throw error;
  }
}
