import { redirect } from 'next/navigation'

// Design system v1: there is ONE client list — /customers (the route
// family of the customer file /customers/[id], where Cobranza lives).
// This route used to render a second, divergent list («Clientes y
// Exámenes», with its own create/edit/delete modals but no path into
// the customer file). It now redirects to the canonical list; the old
// implementation remains in git history, and its unique features
// (in-list create/edit/delete, aggregated balance) are the porting
// backlog for the canonical list.
export default function AdminCustomersRedirect() {
  redirect('/customers')
}
