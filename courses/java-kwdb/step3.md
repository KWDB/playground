现在我们插入测试数据并执行查询。

## 插入商品数据

```java
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");
        String url = "jdbc:kaiwudb://127.0.0.1:26257/shop_java";
        try (Connection conn = DriverManager.getConnection(url, "root", "")) {
            String sql = "INSERT INTO products (name, price, stock) VALUES (?, ?, ?)";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                Object[][] rows = {
                    {"iPhone 15", new BigDecimal("6999.00"), 100},
                    {"MacBook Pro", new BigDecimal("12999.00"), 50},
                    {"iPad Air", new BigDecimal("4599.00"), 200},
                    {"AirPods Pro", new BigDecimal("1899.00"), 500}
                };
                for (Object[] row : rows) {
                    ps.setString(1, (String) row[0]);
                    ps.setBigDecimal(2, (BigDecimal) row[1]);
                    ps.setInt(3, (Integer) row[2]);
                    ps.addBatch();
                }
                int[] count = ps.executeBatch();
                System.out.println("成功插入 " + count.length + " 条商品记录");
            }
        }
    }
}
```

## 查询商品数据

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");
        String url = "jdbc:kaiwudb://127.0.0.1:26257/shop_java";
        try (Connection conn = DriverManager.getConnection(url, "root", "");
             Statement stmt = conn.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT id, name, price, stock FROM products ORDER BY price");
            System.out.println("商品列表：");
            while (rs.next()) {
                System.out.printf("ID=%d, 名称=%s, 价格=%s, 库存=%d%n",
                    rs.getLong("id"),
                    rs.getString("name"),
                    rs.getBigDecimal("price"),
                    rs.getInt("stock"));
            }
        }
    }
}
```

## 插入时序数据

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.concurrent.ThreadLocalRandom;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");
        String url = "jdbc:kaiwudb://127.0.0.1:26257/shop_java";
        try (Connection conn = DriverManager.getConnection(url, "root", "");
             PreparedStatement ps = conn.prepareStatement(
                 "INSERT INTO sensor_data (ts, device_id, temperature, humidity) VALUES (?, ?, ?, ?)")) {
            for (int i = 0; i < 10; i++) {
                ps.setTimestamp(1, Timestamp.from(Instant.now()));
                ps.setString(2, "sensor_001");
                ps.setDouble(3, 20 + ThreadLocalRandom.current().nextDouble() * 10);
                ps.setDouble(4, 40 + ThreadLocalRandom.current().nextDouble() * 20);
                ps.addBatch();
            }
            ps.executeBatch();
            System.out.println("传感器数据插入成功");
        }
    }
}
```

## 查询时序数据

```java
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

class Main {
    public static void main(String[] args) throws Exception {
        Class.forName("com.kaiwudb.Driver");
        String url = "jdbc:kaiwudb://127.0.0.1:26257/shop_java";
        try (Connection conn = DriverManager.getConnection(url, "root", "");
             Statement stmt = conn.createStatement()) {
            ResultSet rs = stmt.executeQuery("""
                SELECT device_id,
                       COUNT(*) AS points,
                       ROUND(AVG(temperature)::numeric, 2) AS avg_temp,
                       ROUND(AVG(humidity)::numeric, 2) AS avg_humidity
                FROM sensor_data
                GROUP BY device_id
                ORDER BY device_id
            """);
            System.out.println("时序聚合结果：");
            while (rs.next()) {
                System.out.printf(
                    "设备=%s, 数据点=%d, 平均温度=%s, 平均湿度=%s%n",
                    rs.getString("device_id"),
                    rs.getInt("points"),
                    rs.getBigDecimal("avg_temp"),
                    rs.getBigDecimal("avg_humidity")
                );
            }
        }
    }
}
```
