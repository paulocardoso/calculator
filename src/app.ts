// mount renders the app into root. It's separate from main.ts so tests can
// render the app into a test document.
export function mount(root: HTMLElement): void {
  root.innerHTML = "<h1>calculator</h1>";
}
