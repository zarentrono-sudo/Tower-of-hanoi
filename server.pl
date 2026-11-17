% Tower of Hanoi server (SWI-Prolog)
% Serves the game files and solves the puzzle in Prolog at /solve?disks=N
%
% Run:   swipl server.pl
% Open:  http://localhost:8080

:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_files)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_parameters)).

:- initialization(main, main).

:- http_handler(root(solve), solve_handler, []).

% ---------- the Prolog solver ----------
% hanoi(N, From, To, Via, Moves): pegs are numbered 0, 1, 2.
hanoi(0, _, _, _, []) :- !.
hanoi(N, From, To, Via, Moves) :-
    N1 is N - 1,
    hanoi(N1, From, Via, To, Before),
    hanoi(N1, Via, To, From, After),
    append(Before, [From-To|After], Moves).

solve_handler(Request) :-
    http_parameters(Request, [disks(N, [integer, default(4)])]),
    (   between(1, 10, N)
    ->  hanoi(N, 0, 2, 1, Pairs),
        findall([F, T], member(F-T, Pairs), Moves),
        length(Moves, Count),
        reply_json_dict(_{disks: N, count: Count, moves: Moves})
    ;   reply_json_dict(_{error: "disks must be between 1 and 10"}, [status(400)])
    ).

% ---------- start the server ----------
main :-
    main(8080).

main(Port) :-
    source_file(main, File),
    file_directory_name(File, Dir),
    http_handler(root(.), http_reply_from_files(Dir, []), [prefix]),
    http_server(http_dispatch, [port(Port)]),
    format("Tower of Hanoi server running at http://localhost:~w~n", [Port]),
    format("Press Ctrl+C to stop.~n"),
    thread_get_message(_).
