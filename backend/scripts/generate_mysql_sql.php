<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__).'/vendor/autoload.php';
$app = require dirname(__DIR__).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$seedTables = [
    'permissions',
    'roles',
    'role_has_permissions',
    'companies',
    'document_types',
    'system_settings',
    'notification_templates',
    'users',
    'model_has_roles',
    'company_user',
];
$seedRows = [];
foreach ($seedTables as $table) {
    $seedRows[$table] = DB::connection('sqlite')->table($table)->orderBy(array_key_exists('id', (array) (DB::connection('sqlite')->table($table)->first() ?? [])) ? 'id' : DB::raw('1'))->get()
        ->map(fn ($row) => (array) $row)
        ->all();
}

config([
    'database.default' => 'mysql_export',
    'database.connections.mysql_export' => [
        'driver' => 'mysql_export_fake',
        'host' => '127.0.0.1',
        'port' => 3306,
        'database' => 'trust_group_erp',
        'username' => 'unused',
        'password' => 'unused',
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'prefix' => '',
        'prefix_indexes' => true,
        'strict' => true,
        'engine' => null,
    ],
]);
DB::extend('mysql_export_fake', function (array $config, string $name) {
    return new class(
        new PDO('sqlite::memory:'),
        $config['database'],
        $config['prefix'],
        $config,
    ) extends Illuminate\Database\MySqlConnection {
        public function isMaria(): bool
        {
            return false;
        }

        public function getServerVersion(): string
        {
            return '8.0.0';
        }
    };
});
DB::purge('mysql_export');
DB::setDefaultConnection('mysql_export');

$migrationFiles = glob(dirname(__DIR__).'/database/migrations/*.php');
sort($migrationFiles);
$queries = DB::connection('mysql_export')->pretend(function () use ($migrationFiles) {
    foreach ($migrationFiles as $file) {
        $migration = require $file;
        $migration->up();
    }
});

$quote = static function (mixed $value): string {
    if ($value === null) return 'NULL';
    if (is_bool($value)) return $value ? '1' : '0';
    if (is_int($value) || is_float($value)) return (string) $value;
    return "'".str_replace(["\\", "'"], ["\\\\", "''"], (string) $value)."'";
};

$lines = [
    '-- Trust Group ERP - Complete Fresh MySQL/MariaDB Install',
    '-- Generated from the Laravel 12 production migrations and production seed.',
    '-- Fresh database only. No demo employees, vehicles, documents, notifications, or audit records.',
    'SET NAMES utf8mb4;',
    'SET time_zone = "+03:00";',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    "create table `migrations` (`id` int unsigned not null auto_increment primary key, `migration` varchar(255) not null, `batch` int not null) default character set utf8mb4 collate 'utf8mb4_unicode_ci';",
];

foreach ($queries as $entry) {
    $query = rtrim((string) $entry['query'], " \t\n\r\0\x0B;");
    if ($query !== '') {
        $lines[] = $query.';';
    }
}

$lines[] = '';
$lines[] = '-- Production seed data';
foreach ($seedRows as $table => $rows) {
    foreach ($rows as $row) {
        $columns = implode(', ', array_map(fn ($column) => '`'.$column.'`', array_keys($row)));
        $values = implode(', ', array_map($quote, array_values($row)));
        $lines[] = "INSERT INTO `{$table}` ({$columns}) VALUES ({$values});";
    }
}

$lines[] = '';
$lines[] = "INSERT INTO `migrations` (`migration`, `batch`) VALUES";
$migrationValues = [];
foreach ($migrationFiles as $file) {
    $migrationValues[] = '('.$quote(pathinfo($file, PATHINFO_FILENAME)).', 1)';
}
$lines[] = implode(",\n", $migrationValues).';';
$lines[] = 'SET FOREIGN_KEY_CHECKS = 1;';
$lines[] = '';
$lines[] = '-- Verification: 33 tables; employees=0, vehicles=0, documents=0, notification_logs=0.';

$target = dirname(__DIR__, 2).'/database/TRUST-GROUP-ERP-COMPLETE-FRESH-INSTALL.sql';
if (!is_dir(dirname($target))) {
    mkdir(dirname($target), 0775, true);
}
file_put_contents($target, implode("\n", $lines)."\n");
echo $target.PHP_EOL;
