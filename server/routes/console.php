<?php

use Illuminate\Support\Facades\Schedule;

/*
| One cPanel cron entry, every minute:
|   * * * * * /usr/local/bin/php /home/<user>/medipharm-api/artisan schedule:run >> /dev/null 2>&1
| Everything else is dispatched from here (spec §10.5).
*/

// Drains queued jobs without a daemon. --max-time=50 exits before the next
// tick so workers never pile up against the entry-process limit.
Schedule::command('queue:work --stop-when-empty --max-time=50')->everyMinute()->withoutOverlapping();

Schedule::command('medipharm:expiry-sweep')->dailyAt('00:30');
Schedule::command('backup:database')->dailyAt('01:00');
Schedule::command('medipharm:billing-check')->dailyAt('02:00');
Schedule::command('medipharm:low-stock-digest')->dailyAt('07:00')->timezone('Africa/Lagos');

Schedule::command('queue:prune-batches')->weekly();
Schedule::command('cache:prune-stale-tags')->weekly();
