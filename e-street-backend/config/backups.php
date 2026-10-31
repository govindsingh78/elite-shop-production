<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Database backups
    |--------------------------------------------------------------------------
    |
    | Admin › Server & health › Backups. Files stay outside public/, so they can only be reached through a
    | signed link. The MySQL client tools come from the server's PATH unless these say otherwise.
    |
    */

    'path' => env('BACKUP_PATH', storage_path('app/private/backups')),
    'mysqldump' => env('MYSQLDUMP_PATH', 'mysqldump'),
    'mysql' => env('MYSQL_CLIENT_PATH', 'mysql'),

    // Which database connection to back up. Empty means the store's own.
    'connection' => env('BACKUP_CONNECTION'),

];
