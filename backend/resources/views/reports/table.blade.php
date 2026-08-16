<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #172033; }
        h1 { margin: 0 0 4px; font-size: 18px; }
        p { margin: 0 0 16px; color: #667085; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #12243d; color: white; text-align: left; }
        th, td { border: 1px solid #d9dee8; padding: 6px; }
        tr:nth-child(even) td { background: #f6f8fb; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <p>Generated {{ $generatedAt }} (Asia/Qatar)</p>
    <table>
        <thead><tr>@foreach ($headings as $heading)<th>{{ $heading }}</th>@endforeach</tr></thead>
        <tbody>
        @forelse ($rows as $row)
            <tr>@foreach ($row as $value)<td>{{ $value }}</td>@endforeach</tr>
        @empty
            <tr><td colspan="{{ count($headings) }}">No records found.</td></tr>
        @endforelse
        </tbody>
    </table>
</body>
</html>
