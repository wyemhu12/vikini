import GemModal from "../../gems/components/GemModal";

export default function MainLayout({children}){ 
  return (
    <div className="relative">
      {children}
      <GemModal />
    </div>
  ); 
}