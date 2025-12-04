#!/bin/bash

# 初始化随机数种子
RANDOM=$$$(date +%s)

# 初始化时间戳
start_time=$(date +%s)  # 获取当前时间戳

# 高效随机字符串生成
rand_str() {
    LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c1
}

# 默认参数
DEFAULT_OUTPUT_PATH="kwbase-data"

# 如果有传入参数，就使用传入的参数，否则使用默认参数
DEFAULT_PATH=${1:-$DEFAULT_OUTPUT_PATH}

# 单表生成函数
generate_csv() {
    # 预生成基准数据
    declare -a branch_arr=( $(seq -f "branch_%g" 1 8) )
    declare -a site_arr=( $(seq -f "site_%g" 1 436) )
    declare -a region_arr=( $(seq -f "region_%g" 1 41) )
    declare -a pipe_arr=( $(seq -f "pipe_%g" 1 26) )
    declare -a point_arr=( $(seq -f "point_%g" 1 1500) )

    local table=$1
    mkdir -p $DEFAULT_PATH/extern
    
    case $table in
        operation_branch)
        output="$DEFAULT_PATH/extern/operation_branch/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/operation_branch
            for com in "${branch_arr[@]}"; do
                printf "%s,Company_%s,Desc_%s\n" \
                    "$com" "$(rand_str)" "$(rand_str)"
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        site_info)
        output="$DEFAULT_PATH/extern/site_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/site_info
            for sn in "${site_arr[@]}"; do
                printf "%s,Station_%s,%s,%s,Loc_%s,Desc_%s\n" \
                    "$sn" "$(rand_str)" \
                    "${region_arr[RANDOM%41]}" \
                    "${branch_arr[RANDOM%8]}" \
                    "$(rand_str)" "$(rand_str)"
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        region_info)
        output="$DEFAULT_PATH/extern/region_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/region_info
            i=1
            for area in "${region_arr[@]}"; do
                printf "%s,Area_%s,Loc_%s,Desc_%s\n" \
                    "$area" "$i" \
                    "$(rand_str)" "$(rand_str)"
                    ((i++))
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        pipeline_info)
        output="$DEFAULT_PATH/extern/pipeline_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/pipeline_info
            i=1
            for pipe in "${pipe_arr[@]}"; do
                printf "%s,Pipe_%s,Start_%s,End_%s,Prop_%s\n" \
                    "$pipe" "$i" \
                    "$(rand_str)" "$(rand_str)" "$(rand_str)"
                    ((i++))
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        point_base_info)
        output="$DEFAULT_PATH/extern/point_base_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/point_base_info
            for point in "${point_arr[@]}"; do
                printf "%s,SIG_%s,Desc_%s,%d,%s,%s\n" \
                    "$point" "$(rand_str)" \
                    "$(rand_str)" $((RANDOM%10+1)) \
                    "${site_arr[RANDOM%436]}" \
                    "${pipe_arr[RANDOM%26]}"
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        t_monitor_point)
        output="$DEFAULT_PATH/extern/t_monitor_point/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/t_monitor_point
            for ((i=1; i<=10000; i++)); do
                printf "%s,%d,%s,%s,%s,%s,%s,%d,%d\n" \
                   "$(date -d "@$((start_time + i))" "+%Y-%m-%d %H:%M:%S")" \
                    $((RANDOM%1000)) \
                    "${point_arr[RANDOM%1500]}" \
                    "${branch_arr[RANDOM%8]}" \
                    "${region_arr[RANDOM%41]}" \
                    "${site_arr[RANDOM%436]}" \
                    "${pipe_arr[RANDOM%26]}" \
                    $((RANDOM%10+1)) \
                    $((RANDOM%100))
            done > "$output"
            echo "成功生成时序表$table的数据,输出到$output"
            ;;
    esac
}

# 主执行流程
declare -A table_structures
table_structures[t_monitor_point]="k_collect_time,monitor_value,point_id,branch_id,region_id,site_id,pipeline_id,monitor_type,monitor_position"
table_structures[site_info]="site_id,site_name,region_id,branch_id,site_address,site_desc"
table_structures[region_info]="region_id,region_name,region_address,region_desc"
table_structures[operation_branch]="branch_id,branch_name,business_scope"
table_structures[pipeline_info]="pipeline_id,pipeline_name,pipe_start_point,pipe_end_point,pipe_spec"
table_structures[point_base_info]="point_id,signal_id,signal_desc,signal_type,site_id,pipeline_id"

export -f generate_csv rand_str
    
# 并行模式（需要parallel命令支持）
if command -v parallel &>/dev/null; then
    tables=("t_monitor_point" "site_info" "region_info" "operation_branch" "pipeline_info" "point_base_info")
    parallel generate_csv ::: "${tables[@]}"
    echo "并行模式执行完成"
else
    echo "未安装GNU parallel,自动切换为串行模式,建议安装parallel：sudo apt install parallel"
    generate_csv site_info
    generate_csv region_info
    generate_csv pipeline_info
    generate_csv operation_branch
    generate_csv point_base_info
    generate_csv t_monitor_point
fi
