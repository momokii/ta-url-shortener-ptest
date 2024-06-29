# run on wsl if using windows
docker run --rm -it -u "$(id -u):$(id -g)" -v "${PWD}:/xk6" \
grafana/xk6 build v0.43.1 --with github.com/grafana/xk6-dashboard@latest --with github.com/szkiba/xk6-dotenv@latest