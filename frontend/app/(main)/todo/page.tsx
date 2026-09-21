import { redirect } from "next/navigation";

// The default view lives at home now; bare /todo is kept for old links.
export default function TodoPage() {
  redirect("/");
}
