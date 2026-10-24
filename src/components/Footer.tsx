/**
 * Footer with data-source attribution. Every number on screen names its source.
 */
export function Footer() {
  return (
    <footer
      style={{
        padding: '0.75rem 1rem',
        background: '#eceff1',
        borderTop: '1px solid #d4dadd',
        fontSize: '0.8rem',
        color: '#4a5760',
      }}
    >
      Data: FIShBOT (Commercial Fisheries Research Foundation), eMOLT, NOAA NDBC buoy 44013,
      MassGIS. Layers labeled MEASURED or MODELED. Missing values shown as gaps, never zero.
    </footer>
  );
}
