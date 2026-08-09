cmake_minimum_required(VERSION 3.16)
project(rp_graph_engine C)

set(CMAKE_C_STANDARD 11)

add_library(rp_layout SHARED native/layout3d.c)
target_include_directories(rp_layout PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/native)
if(WIN32)
  set_target_properties(rp_layout PROPERTIES PREFIX "" OUTPUT_NAME "rp_layout")
endif()

add_executable(rp-graph-engine native/layout3d.c)
target_compile_definitions(rp-graph-engine PRIVATE RP_GRAPH_CLI=1)

install(TARGETS rp_layout rp-graph-engine
  RUNTIME DESTINATION bin
  LIBRARY DESTINATION lib
  ARCHIVE DESTINATION lib
)
