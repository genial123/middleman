#! /bin/sh

### BEGIN INIT INFO
# Provides:				middleman
# Required-Start:		$local_fs $network $remote_fs
# Required-Stop:		$local_fs $network $remote_fs
# Should-Start:			$NetworkManager
# Should-Stop:			$NetworkManager
# Default-Start:		2 3 4 5
# Default-Stop:			0 1 6
# Short-Description:	starts instance of Middleman
# Description:			starts instance of Middleman using start-stop-daemon
### END INIT INFO

if [ -f /etc/default/middleman ]; then
	. /etc/default/middleman
else
	echo "/etc/default/middleman not found, using default settings"
fi

## Don't edit this file
## Edit user configuration in /etc/default/middleman to change defaults
##
## MM_USER= username to run Middleman under, the default is middleman
## MM_HOME= the location of the Middleman application, the default is /opt/middleman
## MM_DATA= the location of the Middleman data, the default is /var/middleman
## MM_PIDFILE= the location of middleman.pid, the default is /var/run/middleman.pid
## NODE_BIN= the location of the Node binary
## MM_OPTS= extra Middleman options
## SSD_OPTS= extra start-stop-daemon options

. /lib/init/vars.sh
. /lib/lsb/init-functions

NAME=middleman
DESC=Middleman

RUN_AS=${MM_USER-middleman}
APP_PATH=${MM_HOME-/opt/middleman}
DATA_DIR=${MM_DATA-/var/midleman}
PID_FILE=${MM_PIDFILE-/var/run/middleman/middleman.pid}
DAEMON=${NODE_BIN-$(which node)}
EXTRA_DAEMON_OPTS=${MM_OPTS-}
EXTRA_SSD_OPTS=${SSD_OPTS-}

PID_PATH=$(dirname $PID_FILE)
DAEMON_OPTS=" server.js --daemon --pidfile ${PID_FILE} --datadir ${DATA_DIR} ${EXTRA_DAEMON_OPTS}"

test -x $DAEMON || exit 0


if [ ! -d $PID_PATH ]; then
	mkdir $PID_PATH
	chown $RUN_AS $PID_PATH
fi

if [ ! -d $DATA_DIR ]; then
	mkdir $DATA_DIR
	chown $RUN_AS $DATA_DIR
fi

if [ -e $PID_FILE ]; then
	PID=$(cat $PID_FILE)
	if ! kill -0 $PID > /dev/null 2>&1; then
		echo "Removing stale $PID_FILE"
		rm $PID_FILE
	fi
fi

case "$1" in
	start)
        start-stop-daemon -d $APP_PATH -c $RUN_AS $EXTRA_SSD_OPTS --start --pidfile $PID_FILE --exec $DAEMON -- $DAEMON_OPTS
		;;
	stop)
		echo "Stopping $DESC..."
		start-stop-daemon --stop --pidfile $PID_FILE --retry 15
		;;
	restart)
		echo "Stopping $DESC..."
		start-stop-daemon --stop --pidfile $PID_FILE --retry 15
		start-stop-daemon -d $APP_PATH -c $RUN_AS $EXTRA_SSD_OPTS --start --pidfile $PID_FILE --exec $DAEMON -- $DAEMON_OPTS
		;;
	status)
		status_of_proc -p $PID_FILE "$DAEMON" "$NAME"
		;;
	*)
		N=/etc/init.d/$NAME
		echo "Usage: $N {start|stop|restart|status}" >&2
		exit 1
		;;
esac

exit 0
