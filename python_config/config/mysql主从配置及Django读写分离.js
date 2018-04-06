1. 主从同步的定义
    主从同步使得数据可以从一个数据库服务器复制到其他服务器上，在复制数
    据时，一个服务器充当主服务器（master），其余的服务器充当从服务器（slave）。
    因为复制是异步进行的，所以从服务器不需要一直连接着主服务器，从服务器甚
    至可以通过拨号断断续续地连接主服务器。通过配置文件，可以指定复制所有的
    数据库，某个数据库，甚至是某个数据库上的某个表。

    使用主从同步的好处：
        （1） 通过增加从服务器来提高数据库的性能，在主服务器上执行写入和更新，
        在从服务器上向外提供读功能，可以动态地调整从服务器的数量，从而调
        整整个数据库的性能。
        （2） 提高数据安全，因为数据已复制到从服务器，从服务器可以终止复制进程，
        所以，可以在从服务器上备份而不破坏主服务器相应数据
        （3） 在主服务器上生成实时数据，而在从服务器上分析这些数据，从而提高主
        服务器的性能

2. 主从同步的机制
    Mysql 服务器之间的主从同步是基于二进制日志机制，主服务器使用二进制
    日志来记录数据库的变动情况，从服务器通过读取和执行该日志文件来保持和主
    服务器的数据一致。
    在使用二进制日志时，主服务器的所有操作都会被记录下来，然后从服务器
    会接收到该日志的一个副本。从服务器可以指定执行该日志中的哪一类事件（譬
    如只插入数据或者只更新数据），默认会执行日志中的所有语句。
    每一个从服务器会记录关于二进制日志的信息：文件名和已经处理过的语句，
    这样意味着不同的从服务器可以分别执行同一个二进制日志的不同部分，并且从
    服务器可以随时连接或者中断和服务器的连接。
    主服务器和每一个从服务器都必须配置一个唯一的 ID 号（在 my.cnf 文件的
    [mysqld]模块下有一个 server-id 配置项），另外，每一个从服务器还需要通过
    CHANGE	MASTER	TO 语句来配置它要连接的主服务器的 ip 地址，日志文件名称和
    该日志里面的位置（这些信息存储在主服务器的数据库里）

3. 配置主从同步的基本步骤
    有很多种配置主从同步的方法，可以总结为如下的步骤：
        （1） 在主服务器上，必须开启二进制日志机制和配置一个独立的 ID
        （2） 在每一个从服务器上，配置一个唯一的 ID，创建一个用来专门复制主服
        务器数据的账号
        （3） 在开始复制进程前，在主服务器上记录二进制文件的位置信息
        （4） 如果在开始复制之前，数据库中已经有数据，就必须先创建一个数据快照
        （可以使用 mysqldump 导出数据库，或者直接复制数据文件）
        （5） 配置从服务器要连接的主服务器的 IP 地址和登陆授权，二进制日志文件
        名和位置

4. 详细配置主从同步的方法
    主和从的身份可以自己指定，我们将Ubuntu虚拟机中MySQL作为主服务器，
    将 Windows 中的 MySQL 作为从服务器。	
    在主从设置前，要保证 Ubuntu 与 Windows 间的网络连通。	

    4.1 备份主服务器原有数据到从服务器
        如果在设置主从同步前，主服务器上已有大量数据，可以使用 mysqldump 进
        行数据备份并还原到从服务器以实现数据的复制。
        1. 在主服务器 Ubuntu 上进行备份，执行命令：
        mysqldump	 -uroot	 -pmysql	 --all-databases	 --lock-all-tables > ~/master_db.sql
            -u	：用户名
            -p ：示密码
            --all-databases ：导出所有数据库
            --lock-all-tables ：执行操作时锁住所有表，防止操作时有数据修改
            ~/master_db.sql :导出的备份数据（sql 文件）位置，可自己指定
        
        2. 在从服务器上进行数据还原
            将主服务器生成的master_db.sql文件复制到从服务器。
            mysql	–uroot	–pmysql	< master_db.sql

    4.2 配置主服务器 master（Ubuntu 中的 MySQL）
        1.	编辑设置 mysqld 的配置文件，设置 log_bin 和 server-id   #bind-address=127.0.0.1(将bind-address注释)

            sudo	vim	/etc/mysql/mysql.conf.d/mysqld.cnf
        2. 重启 mysql 服务
            sudo	service	mysql	restart
        3. 登入主服务器 Ubuntu 中的 mysql，创建用于从服务器同步数据使用的帐号
            mysql	–uroot	–pmysql
            GRANT	 REPLICATION SLAVE ON *.* TO 'slave'@'%' identified	 by 'slave'; # 创建账号并设置权限
            FLUSH	PRIVILEGES;  # 刷新权限

        4. 获取主服务器的二进制日志信息
            SHOW	MASTER	STATUS;
            File 为使用的日志文件名字，Position 为使用的文件位置，这两个参数
            须记下，配置从服务器时会用到。

    4.3 配置从服务器 slave（Windows 中的 MySQL）
        1.	找到 Windows 中 MySQL 的配置文件
        2.	编辑 my.ini 文件，将 server-id 修改为 2，并保存退出。
        3.	打开 windows 服务管理
            可以在开始菜单中输入 services.msc 找到并运行。
        4. 在打开的服务管理中找到 MySQL57，并重启该服务
        5. 进入 windows 的 mysql，设置连接到 master 主服务器
            change master to master_host='192.168.79.128', master_user='slave',
            master_password='slave',master_log_file='mysql-bin.000007',
            master_log_pos=466;
                注：
                master_host：主服务器 Ubuntu 的 ip 地址
                master_log_file: 前面查询到的主服务器日志文件名
                master_log_pos: 前面查询到的主服务器日志文件位置
        6. 开启同步，查看同步状态
            start slave;
            show slave status;
            在这里主要是看:
                   Slave_IO_Running=Yes
                   Slave_SQL_Running=Yes

    4.4 测试主从同步
        在 Ubuntu 的 MySQL 中（主服务器）创建一个数据库
        在 Windows 的 MySQL 中（从服务器）查看新建的数据库是否存在


        GRANT REPLICATION SLAVE ON *.* TO 'SLAVE'@'%' IDENTIFIED BY 'slave';

Django中定义读写分离
    1. 在settings.py文件中指定多个数据库
        DATABASES = {
            'default': {
                'NAME': 'app_data',
                'ENGINE': 'django.db.backends.mysql',
                'USER': 'postgres_user',
                'PASSWORD': 's3krit',
                'HOST':'192.168.59.128',
                'PORT':3306
            },
            'users': {
                'NAME': 'app_data',
                'ENGINE': 'django.db.backends.mysql',
                'USER': 'mysql_user',
                'PASSWORD': 'priv4te',
                'HOST':'192.168.59.129',
                'PORT':3306
            }
        }
    
    2. 定义数据库路由类，实现四个方法：
        class AuthRouter(object):
             def db_for_read(self, model, **hints):
                """
                对于model，返回一个读取的时候用到的数据库。
                返回的是settings中定义的数据库的键，比如上面的default或者users               

            def db_for_write(self, model, **hints):
                返回写入的时候用到的数据库，
                比如说上面我们定义了两个数据库，一个是default和users

            def allow_relation(self, obj1, obj2, **hints):
                是否允许关联，如果允许返回true，否则返回False

            def allow_migrate(self, db, app_label, model=None, **hints):
                定义迁移操作是否允许在别名为db的数据库上运行。
                如果操作应该运行则返回True ，
                如果不应该运行则返回False，
                如果路由无法判断则返回None。
                位置参数app_label 是正在迁移的应用的标签。

    3. 在settings中，DATABASE_ROUTERS 设置安装。这个设置定义一个类名的列表，
        其中每个类表示一个路由，它们将被主路由（django.db.router）使用。

        Django 的数据库操作使用主路由来分配数据库的使用。
        每当一个查询需要知道使用哪一个数据库时，它将调用主路由，并提供一个模型和一个Hint （可选）。
        随后 Django 依次测试每个路由直至找到一个数据库的建议。
        如果找不到建议，它将尝试Hint 实例的当前_state.db。
        如果没有提供Hint 实例，或者该实例当前没有数据库状态，主路由将分配default 数据库。
    
    4. 详情见
        http://python.usyiyi.cn/documents/django_182/topics/db/multi-db.html#db_for_read