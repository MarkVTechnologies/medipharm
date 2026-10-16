<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

/**
 * Nightly mysqldump to a non-public directory, 14-day retention (spec §9.4).
 */
class BackupDatabase extends Command
{
    protected $signature = 'backup:database';

    protected $description = 'Dump the MySQL database to the backup directory and prune old dumps';

    public function handle(): int
    {
        $db = config('database.connections.'.config('database.default'));
        if (! in_array($db['driver'], ['mysql', 'mariadb'], true)) {
            $this->warn('Backups only run against MySQL.');

            return self::SUCCESS;
        }

        $dir = config('medipharm.backup_path');
        File::ensureDirectoryExists($dir, 0700);
        $file = $dir.'/medipharm-'.now()->format('Ymd-His').'.sql.gz';

        // Password passed via env, never on the command line (visible in ps).
        $process = Process::fromShellCommandline(
            'mysqldump --single-transaction --quick --no-tablespaces -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" | gzip > "$OUT"',
            null,
            ['MYSQL_PWD' => $db['password'], 'DB_HOST' => $db['host'], 'DB_PORT' => $db['port'], 'DB_USER' => $db['username'], 'DB_NAME' => $db['database'], 'OUT' => $file],
        );
        $process->setTimeout(600)->run();

        if (! $process->isSuccessful()) {
            $this->error('Backup failed: '.trim($process->getErrorOutput()));

            return self::FAILURE;
        }

        $cutoff = now()->subDays(config('medipharm.backup_retention_days'))->getTimestamp();
        foreach (File::glob($dir.'/medipharm-*.sql.gz') as $old) {
            if (File::lastModified($old) < $cutoff) {
                File::delete($old);
            }
        }

        $this->info("Backup written to {$file}");

        return self::SUCCESS;
    }
}
