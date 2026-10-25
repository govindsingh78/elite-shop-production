<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Approved admin email addresses
    |--------------------------------------------------------------------------
    |
    | The only addresses that can hold an admin role ("admin" or "superadmin"). Nobody can be given an
    | admin role with any other address, and an admin account with any other address can't sign in to the
    | admin portal or use the admin API. Changing this list needs a code change and a deploy, on purpose.
    |
    | To make one of these addresses an admin on the server: php artisan admin:grant <email>
    |
    */

    'emails' => [
        'govindsingh78@gmail.com',
        'er.govindsingh.444@gmail.com',
    ],

];
