cmake_minimum_required(VERSION 3.16)
project(rp_graph_layout C)

set(CMAKE_C_STANDARD 11)

add_library(rp_layout SHARED layout3d.c)
target_include_directories(rp_layout PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
if(WIN32)
  set_target_properties(rp_layout PROPERTIES PREFIX "" OUTPUT_NAME "rp_layout")
endif()

# 布局加速 CLI；勿与 graph_engine_core 的 MCP 索引引擎 rp-graph-engine 混淆
add_executable(rp-layout-cli layout3d.c)
target_compile_definitions(rp-layout-cli PRIVATE RP_GRAPH_CLI=1)

install(TARGETS rp_layout rp-layout-cli
  RUNTIME DESTINATION bin
  LIBRARY DESTINATION lib
  ARCHIVE DESTINATION lib
)
