{{--
    Every Elitezaar email (see App\Mail\BrandedMail). Table layout and inline styles, so it looks the same in
    Gmail, Outlook, Apple Mail and on phones; the wordmark is text, so the header still reads with images off.
--}}
@php
    $font = "'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    $tones = [
        'info' => ['#eef7f8', '#2f9aa6', '#1d4f55'],
        'success' => ['#ecf6f0', '#2e8b57', '#1f5136'],
        'warning' => ['#fdf5e6', '#c98a2b', '#6b4a12'],
        'danger' => ['#fcefec', '#c0503f', '#7c3328'],
    ];
    $sectionTitle = "margin:0 0 10px;font-family:{$font};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#8a7a5e;";
    $why = [
        'guest' => 'You’re receiving this email because you placed an order on Elitezaar with this address.',
        'customer' => 'You’re receiving this email because you have an Elitezaar account.',
        'seller' => 'You’re receiving this email because you sell on Elitezaar.',
        'admin' => 'You’re receiving this email as an Elitezaar store administrator.',
    ][$audience] ?? 'This is a service email from Elitezaar.';
    $phones = $support['phones'] ?? [];
@endphp
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{ $subject }}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { color: #2f7d70; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 620px) {
        .ez-outer { padding: 16px 8px !important; }
        .ez-body { padding: 28px 22px 26px !important; }
        .ez-headline { font-size: 23px !important; line-height: 30px !important; }
        .ez-button, .ez-button a { display: block !important; width: 100% !important; text-align: center !important; }
        .ez-stack, .ez-stack td { display: block !important; width: 100% !important; }
        .ez-fact-label { padding-bottom: 2px !important; }
    }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3efe6;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{{ \Illuminate\Support\Str::limit($preheader, 140) }}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3efe6" style="background-color:#f3efe6;">
<tr>
<td class="ez-outer" align="center" style="padding:32px 12px 40px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

    {{-- Logo --}}
    <tr>
        <td style="padding:0 4px 22px;">
            <a href="{{ $site }}" target="_blank" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td valign="middle" style="padding-right:12px;"><img src="{{ $site }}/icon-192.png" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:12px;"></td>
                        <td valign="middle" style="font-family:{{ $font }};">
                            <div style="font-size:24px;line-height:26px;font-weight:800;letter-spacing:-0.6px;color:#13291f;">Elite<span style="font-weight:500;color:#2f9aa6;">zaar</span><span style="font-size:13px;font-weight:600;letter-spacing:0;color:#b8874c;">.com</span></div>
                            <div style="padding-top:3px;font-size:9px;line-height:12px;font-weight:700;letter-spacing:2.2px;color:#8a7a5e;">EVERYDAY, ELEVATED.</div>
                        </td>
                    </tr>
                </table>
            </a>
        </td>
    </tr>

    {{-- Card --}}
    <tr>
        <td>
            {{-- "separate", or the rounded border is drawn square. --}}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border-collapse:separate;background-color:#ffffff;border:1px solid #e6dfd0;border-radius:18px;">
                <tr><td height="5" bgcolor="#c99a5b" style="height:5px;line-height:5px;font-size:0;background-color:#c99a5b;background-image:linear-gradient(90deg,#c99a5b,#2f9aa6);border-radius:17px 17px 0 0;">&nbsp;</td></tr>
                <tr>
                    <td class="ez-body" style="padding:36px 40px 34px;font-family:{{ $font }};">
                        @if ($eyebrow)
                            <p style="margin:0 0 10px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#b07a3f;">{{ $eyebrow }}</p>
                        @endif
                        <h1 class="ez-headline" style="margin:0 0 22px;font-family:{{ $font }};font-size:26px;line-height:33px;font-weight:700;letter-spacing:-0.4px;color:#13291f;">{{ $headline }}</h1>
                        <p style="margin:0 0 14px;font-size:16px;line-height:25px;font-weight:600;color:#1d2f28;">{{ $greeting }}</p>
                        @foreach ($paragraphs as $paragraph)
                            <p style="margin:0 0 14px;font-size:16px;line-height:25px;color:#3f4f48;">{{ $paragraph }}</p>
                        @endforeach

                        @foreach ($sections as $section)
                            @switch($section['type'])
                                @case('items')
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 6px;">
                                        @if (!empty($section['title']))
                                            <tr><td colspan="2"><p style="{{ $sectionTitle }}">{{ $section['title'] }}</p></td></tr>
                                        @endif
                                        @foreach ($section['items'] as $item)
                                            <tr>
                                                <td valign="top" style="padding:12px 12px 12px 0;border-top:1px solid #ece6da;font-family:{{ $font }};">
                                                    <div style="font-size:15px;line-height:21px;font-weight:600;color:#1d2f28;">{{ $item['name'] }}</div>
                                                    @if (!empty($item['meta']))
                                                        <div style="padding-top:2px;font-size:13px;line-height:18px;color:#7a867f;">{{ $item['meta'] }}</div>
                                                    @endif
                                                </td>
                                                <td valign="top" align="right" style="padding:12px 0;border-top:1px solid #ece6da;font-family:{{ $font }};font-size:15px;line-height:21px;font-weight:600;color:#1d2f28;white-space:nowrap;">{{ $item['amount'] ?? '' }}</td>
                                            </tr>
                                        @endforeach
                                        @foreach ($section['totals'] ?? [] as $index => $total)
                                            @php $strong = !empty($total['strong']); @endphp
                                            <tr>
                                                <td style="padding:{{ $strong ? '12px' : ($index === 0 ? '12px' : '4px') }} 12px {{ $strong ? '0' : '4px' }} 0;{{ $strong || $index === 0 ? 'border-top:1px solid #ece6da;' : '' }}font-family:{{ $font }};font-size:{{ $strong ? '16px' : '14px' }};line-height:21px;font-weight:{{ $strong ? '700' : '400' }};color:{{ $strong ? '#13291f' : '#5f6e66' }};">{{ $total['label'] }}</td>
                                                <td align="right" style="padding:{{ $strong ? '12px' : ($index === 0 ? '12px' : '4px') }} 0 {{ $strong ? '0' : '4px' }};{{ $strong || $index === 0 ? 'border-top:1px solid #ece6da;' : '' }}font-family:{{ $font }};font-size:{{ $strong ? '17px' : '14px' }};line-height:21px;font-weight:{{ $strong ? '800' : '600' }};color:{{ $strong ? '#13291f' : '#3f4f48' }};white-space:nowrap;">{{ $total['value'] }}</td>
                                            </tr>
                                        @endforeach
                                    </table>
                                    @break

                                @case('facts')
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#faf7f1" style="margin:22px 0 6px;border-collapse:separate;background-color:#faf7f1;border:1px solid #ece6da;border-radius:12px;">
                                        <tr>
                                            <td style="padding:16px 18px 10px;">
                                                @if (!empty($section['title']))
                                                    <p style="{{ $sectionTitle }}">{{ $section['title'] }}</p>
                                                @endif
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                                    @foreach ($section['rows'] as $row)
                                                        <tr class="ez-stack">
                                                            <td class="ez-fact-label" valign="top" width="34%" style="padding:0 12px 8px 0;font-family:{{ $font }};font-size:13px;line-height:20px;font-weight:600;color:#7a867f;">{{ $row['label'] }}</td>
                                                            <td valign="top" style="padding:0 0 8px;font-family:{{ $font }};font-size:14px;line-height:20px;color:#1d2f28;">{{ $row['value'] }}</td>
                                                        </tr>
                                                    @endforeach
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    @break

                                @case('list')
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;">
                                        @if (!empty($section['title']))
                                            <tr><td colspan="2"><p style="{{ $sectionTitle }}">{{ $section['title'] }}</p></td></tr>
                                        @endif
                                        @foreach ($section['items'] as $item)
                                            <tr>
                                                <td valign="top" width="18" style="padding:9px 0 9px;border-top:1px solid #ece6da;font-family:{{ $font }};font-size:14px;line-height:20px;color:#c99a5b;">&#9670;</td>
                                                <td valign="top" style="padding:9px 0 9px 4px;border-top:1px solid #ece6da;font-family:{{ $font }};font-size:14px;line-height:20px;color:#3f4f48;">
                                                    <strong style="color:#1d2f28;">{{ $item['title'] }}</strong>@if (!empty($item['detail'])) <span style="color:#5f6e66;">— {{ $item['detail'] }}</span>@endif
                                                </td>
                                            </tr>
                                        @endforeach
                                    </table>
                                    @break

                                @case('links')
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;">
                                        @if (!empty($section['title']))
                                            <tr><td><p style="{{ $sectionTitle }}">{{ $section['title'] }}</p></td></tr>
                                        @endif
                                        @foreach ($section['links'] as $link)
                                            <tr>
                                                <td style="padding:9px 0;border-top:1px solid #ece6da;font-family:{{ $font }};font-size:14px;line-height:20px;">
                                                    <a href="{{ $link['url'] }}" target="_blank" style="color:#2f7d70;font-weight:700;text-decoration:none;">{{ $link['label'] }} &rarr;</a>@if (!empty($link['hint']))<span style="color:#7a867f;"> &nbsp;{{ $link['hint'] }}</span>@endif
                                                </td>
                                            </tr>
                                        @endforeach
                                    </table>
                                    @break

                                @case('note')
                                    @php [$noteBackground, $noteBorder, $noteText] = $tones[$section['tone'] ?? 'info'] ?? $tones['info']; @endphp
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 6px;">
                                        <tr>
                                            <td bgcolor="{{ $noteBackground }}" style="padding:14px 16px;background-color:{{ $noteBackground }};border-left:4px solid {{ $noteBorder }};border-radius:8px;font-family:{{ $font }};font-size:14px;line-height:21px;color:{{ $noteText }};">{{ $section['text'] }}</td>
                                        </tr>
                                    </table>
                                    @break
                            @endswitch
                        @endforeach

                        @if ($action)
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="ez-button" style="margin:28px 0 8px;">
                                <tr>
                                    <td align="center" bgcolor="#18372e" style="border-radius:12px;background-color:#18372e;">
                                        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{ $action['url'] }}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="24%" stroke="f" fillcolor="#18372e"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">{{ $action['label'] }}</center></v:roundrect><![endif]-->
                                        <!--[if !mso]><!--><a href="{{ $action['url'] }}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:{{ $font }};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">{{ $action['label'] }} &rarr;</a><!--<![endif]-->
                                    </td>
                                </tr>
                            </table>
                        @endif

                        @foreach ($after as $line)
                            <p style="margin:14px 0 0;font-size:14px;line-height:22px;color:#5f6e66;">{{ $line }}</p>
                        @endforeach

                        <p style="margin:28px 0 0;font-size:15px;line-height:23px;color:#3f4f48;">Warm regards,<br><strong style="color:#13291f;">Team Elitezaar</strong></p>

                        @if ($action)
                            <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #ece6da;font-size:12px;line-height:18px;color:#8b968f;">If the button doesn’t work, copy this link into your browser:<br><a href="{{ $action['url'] }}" target="_blank" style="color:#2f7d70;word-break:break-all;">{{ $action['url'] }}</a></p>
                        @endif
                    </td>
                </tr>
            </table>
        </td>
    </tr>

    {{-- Help --}}
    <tr>
        <td style="padding:22px 4px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#18372e" style="background-color:#18372e;border-radius:16px;">
                <tr>
                    <td style="padding:20px 24px;font-family:{{ $font }};">
                        <p style="margin:0 0 4px;font-size:15px;line-height:21px;font-weight:700;color:#ffffff;">Need a hand? We’re here to help.</p>
                        <p style="margin:0;font-size:13px;line-height:21px;color:#c9d6cf;">
                            @if ($phones)
                                Call
                                @foreach ($phones as $phone)
                                    <a href="tel:{{ preg_replace('/[^\d+]/', '', $phone) }}" style="color:#f1d9a6;font-weight:700;text-decoration:none;">{{ $phone }}</a>{{ $loop->last ? '' : ' or' }}
                                @endforeach
                            @endif
                            @if (!empty($support['email']))
                                {{ $phones ? '·' : '' }} email <a href="mailto:{{ $support['email'] }}" style="color:#f1d9a6;font-weight:700;text-decoration:none;">{{ $support['email'] }}</a>
                            @endif
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>

    {{-- Footer --}}
    <tr>
        <td align="center" style="padding:22px 16px 0;font-family:{{ $font }};">
            <p style="margin:0 0 10px;font-size:13px;line-height:20px;">
                <a href="{{ $site }}/shop" target="_blank" style="color:#2f7d70;font-weight:600;text-decoration:none;">Shop</a>
                <span style="color:#c4bba8;">&nbsp;·&nbsp;</span>
                <a href="{{ $site }}/return-refund-policy" target="_blank" style="color:#2f7d70;font-weight:600;text-decoration:none;">Returns &amp; refunds</a>
                <span style="color:#c4bba8;">&nbsp;·&nbsp;</span>
                <a href="{{ $site }}/terms-and-conditions" target="_blank" style="color:#2f7d70;font-weight:600;text-decoration:none;">Terms</a>
                <span style="color:#c4bba8;">&nbsp;·&nbsp;</span>
                <a href="{{ $site }}/privacy-policy" target="_blank" style="color:#2f7d70;font-weight:600;text-decoration:none;">Privacy</a>
            </p>
            <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#8b968f;">{{ $why }}</p>
            <p style="margin:0;font-size:12px;line-height:18px;color:#a39a87;">&copy; {{ $year }} Elitezaar · Everyday, elevated.</p>
        </td>
    </tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>
