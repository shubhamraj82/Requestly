# Session explanation

Stageshow’s `ai-chat` example pairs an answer with its sources. In the realtime tester, each observation has its own source link. The panel uses the tester’s typography and green accent. A warm text color draws attention to the server’s rejection reason.

Chrome checks at 1280 and 390 pixels cover opening the explanation, following a rejection onto an older history page, expanding and focusing the payload, and returning to the latest events. The narrow layout wraps the explanation and keeps the citation visible. Run `npm run test:realtime:browser` against the local fixture-enabled server. Set `WS_SCREENSHOTS` to an existing directory to save both views.

The interaction is driven by the user and the arrival of real events. The Stageshow film gate was run on the reference still and flagged an uneven inset in its window header. The production timeline was checked directly in Chrome.
