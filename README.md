Middleman
=========

### Installation

Clone the Middleman repository, enter it and initialize the application.

```bash
git clone https://github.com/genial123/middleman.git
cd middleman
node server --init
```

If the last command prints "Initialized!" you're almost there!


### Configuration

The "--init" command just created a config-file you'll need to edit. All config-settings are explained in the file __config.man.txt__. Open the config in your favourite editor and fill out the necessities (usernames, password, irc-keys, api-keys, urls, etc):

* __Linux and OS X:__ ~/.middleman/config.json
* __Windows:__ C:\Users\<your-username>\AppData\Local\middleman\config.json

__Note:__ Be careful with the syntax while editing the config. If Middleman can't parse the config as JSON, it will refuse to run.

__Note:__ Only the PTP-modules require CouchPotato and only the BTN-module requires SickBeard. If you for example don't enable the BTN-module, you don't need to fill out the SickBeard-config.


### Fingers crossed

When you're done editing your config, you can load up the application. On Linux/OS X, while standing in the application-folder run:

```bash
node server
```

On Windows, run the following file to start Middleman as a standalone application:

```bash
webkit/windows/middleman.vbs
```

The application will start placed in your system tray so don't panic if you don't see a window appear. Click the icon in your system tray to open Middleman, and minimize the window to put it back into the tray again.

Log-files can be found in the same directory your config is located.


### Manually updating Middleman

Middleman will per default automatically update itself on bugfixes and patches (requires git installed), you can even configure it to auto-update itself on larger releases as well. When it's time for you to manually update the application, make sure you've stopped it first. With Git, update Middleman by running:

```bash
git pull
```

If you didn't install Git you need to manually download the newer zip/tarball from Github and replace the existing application.


### As a Debian/Ubuntu service

Standing in the Middleman application directory, copy the init.d-script that comes with Middleman and make it executable
```bash
sudo cp init/ubuntu /etc/init.d/middleman
sudo chmod +x /etc/init.d/middleman
```

Copy the defaults-file, this is the file you'll use to override the default settings in the init.d-script
```bash
sudo cp init/ubuntu.defaults /etc/default/middleman
```

Edit the defaults file you just copied
```bash
sudo nano /etc/default/middleman
```
* MM_USER is the username you want to run Middleman as
* MM_HOME is the path to the Middleman application
* MM_DATA is the path to the Middleman data directory

Install the service
```bash
sudo update-rc.d middleman defaults
```

Done! You can now start it as any other service by:
```bash
sudo /etc/init.d/middleman start
```


### As a Windows "service"

Create a shortcut to __webkit/windows/middleman.vbs__ in your Startup directory.
