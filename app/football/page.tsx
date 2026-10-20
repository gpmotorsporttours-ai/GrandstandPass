
function WorldMapBackground() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-[#24456B]"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'url("https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.9,
          filter:
            'sepia(1) saturate(2) hue-rotate(345deg) brightness(1.8) contrast(1.2)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(5,18,43,0.65) 0%, rgba(5,18,43,0.05) 65%)',
        }}
      />
    </div>
  );
}
