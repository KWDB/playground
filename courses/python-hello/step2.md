# 变量与数据类型

变量是存储数据的容器。在 Python 中，创建变量非常简单，不需要声明类型。

## 创建变量

在右侧编辑器中输入以下代码：

```python
# 字符串变量
name = "小明"
print(name)

# 整数变量
age = 18
print(age)

# 浮点数变量
height = 1.75
print(height)

# 布尔变量
is_student = True
print(is_student)
```

## 数据类型

Python 自动识别变量类型：

| 类型 | 示例 | 说明 |
|------|------|------|
| `str` | `"Hello"` | 字符串（文本） |
| `int` | `18` | 整数 |
| `float` | `1.75` | 浮点数 |
| `bool` | `True/False` | 布尔值 |

## 查看变量类型

使用 `type()` 函数查看变量的类型：

```python
name = "小明"
age = 18
height = 1.75

print(type(name))   # <class 'str'>
print(type(age))   # <class 'int'>
print(type(height)) # <class 'float'>
```

## 动手试试

创建你自己的变量，尝试不同数据类型！
