# Elitezaar mobile app

The Android and iOS app for Elitezaar, built with React Native and Expo (SDK 57). It uses the same Laravel API as the website (`e-street-backend`), so products, orders, accounts and tracking are shared.

One app covers all three portals:

| Portal | Who | What they can do |
|---|---|---|
| **Store** | Everyone | Home page, shop with search, filters and sorting, product pages, bag, checkout (cash on delivery, UPI and net banking through Razorpay) |
| **Customer** | Shoppers who sign in | Dashboard, order history, **live order tracking** (refreshes every 10 seconds), saved addresses, profile, password |
| **Seller hub** | Vendors (role `seller`) | Sales dashboard, add and edit products with photos, orders for their products, shipping status and tracking updates |
| **Admin** | Admins | Store dashboard, all orders with status, payment and tracking, all products, categories, brands, shipping methods and users |

Sign in from the **Account** tab, then choose **Shopper**, **Seller** or **Admin**. Sellers and admins go straight to their own dashboard.

## Run it on your phone

You need **Node.js 22 or newer** (24 LTS works). You also need the **Expo Go** app on your phone, and it must support the same Expo SDK as the project (57). If Expo Go says the project is incompatible, keep every package on the same SDK by changing `expo` and then running `npx expo install --fix`. Never upgrade or downgrade `expo` on its own.

```bash
cd e-shop-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone).

### Which server the app uses

The address is set in `.env`:

```
EXPO_PUBLIC_API_URL=http://13.55.216.53/api
```

It must end in `/api`. Restart `npx expo start` after changing it.

To use your **local** Laravel instead, the phone must be able to reach your PC:

```bash
# in e-street-backend
php artisan serve --host=0.0.0.0 --port=8000
```

Then set `EXPO_PUBLIC_API_URL=http://YOUR-PC-IP:8000/api` (for example `http://192.168.1.20:8000/api`). Your phone and PC must be on the same Wi-Fi.

## Build an installable app

Builds run in the cloud with EAS, so you don't need Android Studio or a Mac:

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview      # an .apk you can install directly
npx eas-cli@latest build -p android --profile production   # an .aab for the Play Store
npx eas-cli@latest build -p ios --profile production       # needs an Apple Developer account
```

## Before publishing to the stores

- **Switch to HTTPS.** While the API runs on plain `http://13.55.216.53`, `app.json` allows unencrypted traffic: `usesCleartextTraffic` on Android and `NSAllowsArbitraryLoads` on iOS. Once `https://elitezaar.com` works, set `EXPO_PUBLIC_API_URL=https://elitezaar.com/api` and remove both settings. The App Store may reject apps that keep them.
- **Online payments** need the Razorpay keys in the server's `.env`. Without them the app offers cash on delivery only.
- **Password reset** emails a link that opens the website, where the new password is set.

## Project layout

```
src/app/            Screens by URL (Expo Router). (store) = tabs, customer/, vendor/, admin/
src/screens/        Screen components: storefront, auth, customer, backoffice (vendor + admin)
src/components/     UI kit (ui.js), product card, order and tracking pieces, logo
src/context/        Sign-in session, bag, toast messages
src/lib/            API client, config, formatting, tracking statuses, portal settings
assets/             App icon, splash and banners
```

Lint the code with `npx expo lint`, and check the project setup with `npx expo-doctor`.
