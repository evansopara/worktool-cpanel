{{ config('app.name') }} — New Notification
==========================================

{{ $notifTitle }}

{{ $notifMessage }}

@if($actionUrl)
Open the app: {{ $actionUrl }}
@endif

--
You are receiving this email because an action was taken on your {{ config('app.name') }} account.
If this wasn't you, please ignore this email.
