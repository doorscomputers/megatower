export default function TestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Test Page Works!</h1>
      <p>If you see this, Next.js routing is working.</p>

      <h2>Try these links:</h2>
      <ul>
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="/units">Units</a></li>
        <li><a href="/owners">Owners</a></li>
        <li><a href="/readings/electric">Electric Readings</a></li>
        <li><a href="/readings/water">Water Readings</a></li>
        <li><a href="/billing/generate">Generate Bills</a></li>
        <li><a href="/billing/list">Bills List</a></li>
        <li><a href="/payments/record">Record Payment</a></li>
        <li><a href="/reports/collections">Collection Report</a></li>
      </ul>

      <h2>Current Time:</h2>
      <p>{new Date().toLocaleString()}</p>
    </div>
  )
}
