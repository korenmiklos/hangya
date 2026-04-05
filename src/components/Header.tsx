export default function Header() {
  return (
    <header className="bg-amber-700 dark:bg-amber-900 text-white py-4 px-4 shadow-md">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <span className="text-3xl" role="img" aria-label="ant">
          🐜
        </span>
        <div>
          <h1 className="text-xl font-bold leading-tight">Hangya</h1>
          <p className="text-amber-200 text-xs">Ant Nuptial Flight Predictor</p>
        </div>
      </div>
    </header>
  );
}
