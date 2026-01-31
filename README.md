# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Project Documentation

📝 **[Documentation Guidelines](docs/GUIDELINES.md)** - How to create and maintain project docs

### Architecture & Flows

- [City Hydration Flow](docs/city-hydration-flow.md) - Complete POI data pipeline from Overture to database
- [Discovery Swipe Flow](docs/discovery-swipe-flow.md) - User discovery interaction flow
- [Places Nearby Sorting](docs/places-nearby-sorting.md) - Algorithm for sorting nearby places

### Features & Implementation

- [Onboarding Progress Implementation](docs/onboarding-progress-implementation.md) - Onboarding flow and progress tracking
- [Didit Verification Setup](docs/didit-verification-setup.md) - Identity verification integration

> **Note:** When creating new documentation, always add a link here for easy discovery.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Change place status

SELECT p.name, p.category, pr.reason, pr.description
FROM places p
JOIN place_reports pr ON p.id = pr.place_id
WHERE p.active = true;

UPDATE public.places
SET active = false, updated_at = now()
WHERE id IN (SELECT place_id FROM public.place_reports);
