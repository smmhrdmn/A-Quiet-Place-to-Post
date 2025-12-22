## Run in iOS Simulator (from Cursor)

You can run this site inside the iOS Simulator without opening the full Xcode app UI.

### 1. Start the local web server

In a Cursor terminal:

```bash
cd /Users/smmhrdmn/Nez
python -m http.server 8000
```

Leave this terminal running. Your app is now served at `http://localhost:8000`.

### 2. Boot the iOS Simulator

In a second Cursor terminal tab:

```bash
open -a Simulator
```

If the Simulator is already booted, this just brings it to the front.

### 3. Open the app URL in the Simulator

From the same terminal (after the Simulator has booted), run:

```bash
xcrun simctl openurl booted http://localhost:8000
```

This tells the currently booted simulator device to open Safari at your local app URL.

> If you see an error like `Unable to lookup in current state: Shutdown`, boot a device first:
>
> ```bash
> xcrun simctl boot "iPhone 16"
> xcrun simctl openurl booted http://localhost:8000
> ```

Now you can interact with the app in the iOS Simulator just like on a real iPhone.


