CREATE TS DATABASE db_monitor;
CREATE TABLE db_monitor.t_monitor_point (
  k_collect_time timestamp NOT NULL,  
  monitor_value double               
) ATTRIBUTES (
    point_id varchar(64) NOT NULL,   
    branch_id varchar(32),           
    region_id varchar(16),           
    site_id varchar(16),             
    pipeline_id varchar(16) not null,
    monitor_type smallint,             
    monitor_position varchar(64)       
  )
  PRIMARY TAGS(point_id)             
  ACTIVETIME 3h;

CREATE DATABASE monitor_r;
  
CREATE TABLE monitor_r.site_info (
  site_id varchar(16) PRIMARY KEY,  
  site_name varchar(80),               
  region_id varchar(16),             
  branch_id varchar(32),             
  site_address varchar(64),            
  site_desc varchar(128)              
);

CREATE INDEX station_work_area_sn_index ON monitor_r.site_info(region_id);
CREATE INDEX station_name_index ON monitor_r.site_info(site_name);

CREATE TABLE monitor_r.region_info (
  region_id varchar(16) PRIMARY KEY, 
  region_name varchar(80),             
  region_address varchar(64),          
  region_desc varchar(128)            
);
CREATE INDEX workarea_name_index ON monitor_r.region_info(region_name);

CREATE TABLE monitor_r.pipeline_info (
  pipeline_id varchar(16) PRIMARY KEY,
  pipeline_name varchar(60),            
  pipe_start_point varchar(80),         
  pipe_end_point varchar(80),           
  pipe_spec varchar(30)                 
);
CREATE INDEX pipeline_sn_index ON monitor_r.pipeline_info (pipeline_id);
CREATE INDEX pipeline_name_index ON monitor_r.pipeline_info (pipeline_name);

CREATE TABLE monitor_r.point_base_info (
  point_id varchar(64) PRIMARY KEY, 
  signal_id varchar(120),            
  signal_desc varchar(200),           
  signal_type varchar(50),            
  site_id varchar(16),               
  pipeline_id varchar(16)            
);
CREATE INDEX point_station_sn_index ON monitor_r.point_base_info(site_id);
CREATE INDEX point_pipeline_sn_index ON monitor_r.point_base_info(pipeline_id);

CREATE TABLE monitor_r.operation_branch (
  branch_id varchar(32) PRIMARY KEY, 
  branch_name varchar(50),            
  business_scope varchar(128)         
);
CREATE INDEX sub_company_name_index ON monitor_r.operation_branch(branch_name);

import into db_monitor.t_monitor_point CSV DATA ("nodelocal://1/t_monitor_point");
import into monitor_r.site_info CSV DATA ("nodelocal://1/site_info/site_info.csv");
import into monitor_r.region_info CSV DATA ("nodelocal://1/region_info/region_info.csv");
import into monitor_r.pipeline_info CSV DATA ("nodelocal://1/pipeline_info/pipeline_info.csv");
import into monitor_r.point_base_info CSV DATA ("nodelocal://1/point_base_info/point_base_info.csv");
import into monitor_r.operation_branch CSV DATA ("nodelocal://1/operation_branch/operation_branch.csv");