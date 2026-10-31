Steps Documentation


git clone  https://github.com/govindsingh78/elite-shop-production


$ php artisan make:controller AuthController

INFO  Controller [C:\xampp\htdocs\elite-shop-production\e-street-backend\app\Http\Controllers\adminAuthController.php] created successfully.


$ php artisan db:seed

 INFO  Seeding database.

$ php artisan install:api


Login Screen in React and Laravel




https://github.com/govindsingh78/elite-shop-production/commit/dd39a4ec1aff8ebacf5c8bd4826b30813732f989



$ npm install --save react-toastify

up to date, audited 200 packages in 9s

35 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities









Database backups

Admin > Server & health > Backups takes, downloads, restores and deletes backups, and sets the daily one.
Files are kept in e-street-backend/storage/app/private/backups. Do not deploy while a restore is running.

If the admin panel will not open, restore from the server, in the e-street-backend folder:

$ php artisan backups:restore                 (lists the backups)
$ php artisan backups:restore <name>          (restores one, after a safety copy)
$ php artisan backups:restore <name> --skip-safety-copy   (for a database too damaged to copy)
$ php artisan up                              (only if a restore was cut off and the store stayed offline)
