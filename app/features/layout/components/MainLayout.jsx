import GemModal from "../../gems/components/GemModal";

export default function MainLayout({ children }) {
  return (
    <main id="main" className="relative flex-1">
      {children}
      <GemModal />
    </main>
  );
}
