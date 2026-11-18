module.exports = function(app) {
    app.bot.command('/cycle', async (ctx) => {
        handleCycles(ctx)
    });

    app.bot.command('/circle', async (ctx) => {
        handleCycles(ctx)
    });

    app.bot.command('/c ', async (ctx) => {
        handleCycles(ctx)
    });

    const handleCycles = async (ctx) => {
        const chat = await app.getChatFromMessage(ctx);
        if (chat === null) {
            return;
        }
        const subnet = await app.getSubnetFromChat(chat);
        if (subnet === null) {
            return;
        }

        const args = ctx.message.text.split(' ');
        if (
            args.length < 2 
            ) {
            ctx.reply('Укажи устройство, потенциальные циклы которого нужны, например /cycle 00');
            return;
        }

        const device = await app.repository.device.getOneByCode(args[1]);
        if (device === null) {
            ctx.reply('Я не знаю такого устройства');
            return;
        }

        let dates = app.getDates();
        const connections = await app.repository.connection.getAllBySourceDayAndSubnet(device.id, dates.day, subnet.id);
        if (connections.length === 0) {
            ctx.reply('Этого устройства нет на сегодняшней карте. Перешли сообщение с его связями, если посещал его.');
            return;
        }
        
        if (args.length >= 3) {
            handleCycleFixedLength(args, subnet, dates);
            return;
        }

        let cycles = [];
        let cyclesReadable = [];
        const sourceCode = args[1].toUpperCase();
        const delimiter = chat.delimiter ? chat.delimiter : ' → ';
        for (const connection of connections) {
            const target = await app.repository.device.getOneById(connection.target);
            const cycle = await app.dbUtil.pgroute.getRoute(target.code, args[1], dates.day, subnet.id);
            if (cycle === null) {
                continue;
            }
            
            cyclesReadable.push(`${cycle.length}📟 : ${sourceCode}` + delimiter + cycle.join(delimiter));
        }

        ctx.reply(`Кратчайшие закольцованные пути устройства ${sourceCode} через разные связанные:\n` + cyclesReadable.join("\n"));
    }
   
    async function handleCycleFixedLength (args, subnet, dates) {
        const sourceCode = args[1].toUpperCase();
        const source = await app.repository.device.getOneByCode(sourceCode);
        
        const connections = await app.repository.connection.getAllByDayAndSubnet(dates.day, subnet.id);
        
        return;
        
        const route = findRoute(source.id, parseInt(args[2]), connections);
        console.log(route);
        let routeCodes = [];
        for (const node of route) {
            const device = await app.repository.device.getOneById(node);
            routeCodes.push(device.code);
        }
        
        console.log(routeCodes);
    }
    
    function findRoute(start, length, connections) {
        // Создаем объект, где ключами являются узлы, а значениями — массивы связанных с ними узлов
        const graph = {};
        for (const connection of connections) {
            const from  = connection.source;
            const to = connection.target;
            if (!graph[from]) {
                graph[from] = [];
            }
            if (!graph[to]) {
                graph[to] = [];
            }
            graph[from].push(to);
        }

        // Инициализируем массив для хранения маршрута
        const route = [];

        // Вызываем вспомогательную функцию dfs для поиска маршрута
        dfs(start, length, graph, route);

        // Возвращаем найденный маршрут
        return route;
    }

    function dfs(node, length, graph, route, startNode) {
      // Добавляем текущий узел в маршрут
      route.push(node);
    
      // Если маршрут достиг нужной длины и закольцован, возвращаемся
      if (route.length === length && node === startNode) {
        return true;
      }
    
      // Получаем список связанных с текущим узлом узлов
      const connectedNodes = graph[node] || [];
    
      // Проходимся по каждому связанному узлу
      for (const nextNode of connectedNodes) {
        // Если узел уже присутствует в маршруте, пропускаем его
        if (route.includes(nextNode)) {
          continue;
        }
    
        // Рекурсивно вызываем dfs для следующего узла
        if (dfs(nextNode, length, graph, route, startNode)) {
          return true; // Если маршрут найден, возвращаемся
        }
      }
    
      // Если ни один из связанных узлов не привел к нужному маршруту, удаляем текущий узел из маршрута
      route.pop();
      return false;
    }
}