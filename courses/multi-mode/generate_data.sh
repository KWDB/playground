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
    declare -a sub_com_arr=( $(seq -f "sub_com_%g" 1 8) )
    declare -a station_arr=( $(seq -f "station_%g" 1 436) )
    declare -a area_arr=( $(seq -f "area_%g" 1 41) )
    declare -a pipe_arr=( $(seq -f "pipe_%g" 1 26) )
    declare -a point_arr=( $(seq -f "point_%g" 1 1500) )

    local table=$1
    mkdir -p $DEFAULT_PATH/extern
    
    case $table in
        company_info)
        output="$DEFAULT_PATH/extern/company_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/company_info
            for com in "${sub_com_arr[@]}"; do
                printf "%s,Company_%s,Desc_%s\n" \
                    "$com" "$(rand_str)" "$(rand_str)"
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        station_info)
        output="$DEFAULT_PATH/extern/station_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/station_info
            for sn in "${station_arr[@]}"; do
                printf "%s,Station_%s,%s,%s,Loc_%s,Desc_%s\n" \
                    "$sn" "$(rand_str)" \
                    "${area_arr[RANDOM%41]}" \
                    "${sub_com_arr[RANDOM%8]}" \
                    "$(rand_str)" "$(rand_str)"
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        workarea_info)
        output="$DEFAULT_PATH/extern/workarea_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/workarea_info
            i=1
            for area in "${area_arr[@]}"; do
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
        point_info)
        output="$DEFAULT_PATH/extern/point_info/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/point_info
            for point in "${point_arr[@]}"; do
                printf "%s,SIG_%s,Desc_%s,%d,%s,%s\n" \
                    "$point" "$(rand_str)" \
                    "$(rand_str)" $((RANDOM%10+1)) \
                    "${station_arr[RANDOM%436]}" \
                    "${pipe_arr[RANDOM%26]}"
            done > "$output"
            echo "成功生成关系表$table的数据,输出到$output"
            ;;
        t_point)
        output="$DEFAULT_PATH/extern/t_point/${table}.csv"
        mkdir -p $DEFAULT_PATH/extern/t_point
            for ((i=1; i<=10000; i++)); do
                printf "%s,%d,%s,%s,%s,%s,%s,%d,%d\n" \
                   "$(date -d "@$((start_time + i))" "+%Y-%m-%d %H:%M:%S")" \
                    $((RANDOM%1000)) \
                    "${point_arr[RANDOM%1500]}" \
                    "${sub_com_arr[RANDOM%8]}" \
                    "${area_arr[RANDOM%41]}" \
                    "${station_arr[RANDOM%436]}" \
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
table_structures[t_point]="k_timestamp,measure_value,point_sn,sub_com_sn,work_area_sn,station_sn,pipeline_sn,measure_type,measure_location"
table_structures[station_info]="station_sn,station_name,work_area_sn,sub_company_sn,station_location,station_description"
table_structures[workarea_info]="work_area_sn,work_area_name,work_area_location,work_area_description"
table_structures[company_info]="sub_company_sn,sub_company_name,sub_compnay_description"
table_structures[pipeline_info]="pipeline_sn,pipeline_name,pipe_start,pipe_end,pipe_properties"
table_structures[point_info]="point_sn,signal_code,signal_description,signal_type,station_sn,pipeline_sn"

export -f generate_csv rand_str
    
# 并行模式（需要parallel命令支持）
if command -v parallel &>/dev/null; then
    tables=("t_point" "station_info" "workarea_info" "company_info" "pipeline_info" "point_info")
    parallel generate_csv ::: "${tables[@]}"
    echo "并行模式执行完成"
else
    echo "未安装GNU parallel,自动切换为串行模式,建议安装parallel：sudo apt install parallel"
    generate_csv station_info
    generate_csv workarea_info
    generate_csv pipeline_info
    generate_csv company_info
    generate_csv point_info
    generate_csv t_point
fi