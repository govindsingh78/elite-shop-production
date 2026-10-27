{{-- The plain-text part of every Elitezaar email (see App\Mail\BrandedMail and emails/message). --}}
{!! $headline !!}

{!! $greeting !!}

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
@foreach ($sections as $section)
@if (!empty($section['title']))
{!! mb_strtoupper($section['title']) !!}
@endif
@switch($section['type'])
@case('items')
@foreach ($section['items'] as $item)
- {!! $item['name'] !!}{!! !empty($item['meta']) ? " ({$item['meta']})" : '' !!}{!! !empty($item['amount']) ? ": {$item['amount']}" : '' !!}
@endforeach
@foreach ($section['totals'] ?? [] as $total)
{!! $total['label'] !!}: {!! $total['value'] !!}
@endforeach
@break
@case('facts')
@foreach ($section['rows'] as $row)
{!! $row['label'] !!}: {!! $row['value'] !!}
@endforeach
@break
@case('list')
@foreach ($section['items'] as $item)
- {!! $item['title'] !!}{!! !empty($item['detail']) ? " — {$item['detail']}" : '' !!}
@endforeach
@break
@case('links')
@foreach ($section['links'] as $link)
- {!! $link['label'] !!}{!! !empty($link['hint']) ? " {$link['hint']}" : '' !!}: {!! $link['url'] !!}
@endforeach
@break
@case('note')
{!! $section['text'] !!}
@break
@endswitch

@endforeach
@if ($action)
{!! $action['label'] !!}: {!! $action['url'] !!}

@endif
@foreach ($after as $line)
{!! $line !!}

@endforeach
Warm regards,
Team Elitezaar

--
Need a hand? @if (!empty($support['phones']))Call {!! implode(' or ', $support['phones']) !!}@endif{!! !empty($support['email']) ? (!empty($support['phones']) ? ' · ' : '') . "email {$support['email']}" : '' !!}

{!! $site !!}
